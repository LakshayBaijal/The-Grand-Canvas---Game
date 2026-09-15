import 'dart:math';

import 'package:flutter/material.dart';

/// Geometry for drawing with a finger and getting something clean out of it.
///
/// A phone screen is a bad drawing surface: a fingertip is wide, the hand
/// shakes, and glass has no friction. The bots' drawings come from a shape
/// library and look crisp next to anything a person draws. This file is the
/// other half of that -- the maths that turns a shaky stroke into the shape
/// it was trying to be.
///
///   * [smooth]        takes the jitter out of freehand input (free, always).
///   * [recognise]     what a stroke is a wobbly version of: a line, circle,
///                     ellipse, rectangle or triangle -- or nothing, in which
///                     case it is left alone. Used by the Steady Hand tool.
///   * [stampPoints]   a perfect shape, sized to a drag.
///
/// Everything here works in canvas pixels and returns polylines, because
/// that is the only thing a drawing can be made of on the wire.

/// What a drag on the canvas does.
enum DrawTool {
  /// A stroke that follows the finger (smoothed).
  freehand,

  /// A straight line from where the finger went down to where it is.
  line,

  /// A shape stretched over the dragged box -- see [StampShape].
  stamp,
}

enum StampShape { circle, square, triangle, star, heart, arrow, cloud }

// --- smoothing ---------------------------------------------------------------

/// Freehand input, steadied.
///
/// Light enough not to feel like the line is lagging behind the finger, heavy
/// enough that the ten-pixel tremor a hand makes on glass disappears. Two
/// passes: an exponential pull toward each new point while drawing (so what
/// the player sees while drawing is already calm), then a 3-tap average over
/// the finished stroke. Endpoints are never moved, so a stroke still starts
/// and ends exactly where the finger did.
List<Offset> smooth(List<Offset> points) {
  if (points.length < 3) return points;
  final out = List<Offset>.from(points);
  for (var i = 1; i < out.length - 1; i++) {
    out[i] = Offset(
      (points[i - 1].dx + points[i].dx * 2 + points[i + 1].dx) / 4,
      (points[i - 1].dy + points[i].dy * 2 + points[i + 1].dy) / 4,
    );
  }
  return out;
}

/// The next point to record while drawing: [raw] pulled part-way toward the
/// previous point. Null if the finger has not moved at all, so a still finger
/// does not pile up points. The dead-zone is sub-pixel on purpose: a slow,
/// careful drag moves less than a pixel per event and must still be drawn.
/// The pull means a stroke trails the finger slightly, which is why the
/// controller pins the final point to the raw lift-off position.
Offset? steadied(Offset previous, Offset raw) {
  if ((raw - previous).distance < 0.4) return null;
  return previous + (raw - previous) * 0.6;
}

// --- recognition -------------------------------------------------------------

/// What a stroke was trying to be, drawn properly -- or null if it was not
/// clearly trying to be anything, in which case it should stay as drawn.
///
/// Conservative on purpose. Snapping a stroke the player meant as a wobbly
/// curve into an ellipse is worse than leaving a slightly wobbly circle
/// alone: the second is a drawing, the first is the app being wrong. The
/// tolerances below are the widest that a test set of deliberately shaky
/// shapes still passes without a set of deliberately non-shapes snapping.
List<Offset>? recognise(List<Offset> points) {
  if (points.length < 6) return null;
  final box = _bounds(points);
  final diag = box.longestSide == 0 ? 0.0 : sqrt(box.width * box.width + box.height * box.height);
  if (diag < 24) return null; // a dot, not a shape

  final first = points.first;
  final last = points.last;
  final closed = (last - first).distance < diag * 0.22;

  if (!closed) {
    // A line: everything within a narrow band of the chord.
    final chord = (last - first).distance;
    if (chord < 20) return null;
    var worst = 0.0;
    for (final p in points) {
      worst = max(worst, _distanceToSegment(p, first, last));
    }
    if (worst <= max(4.0, chord * 0.06)) return [first, last];
    return null;
  }

  // Closed: a polygon with few corners, or a round thing.
  final corners = _corners(points, diag * 0.075);
  if (corners.length == 3) return [...corners, corners.first];
  if (corners.length == 4 && _isRectangular(corners)) {
    // Axis-aligned to the stroke's box -- a hand-drawn rectangle is nearly
    // always meant to sit straight.
    return [
      box.topLeft, box.topRight, box.bottomRight, box.bottomLeft, box.topLeft,
    ];
  }

  // Ellipse fit: how far, on average, the points sit from the ellipse
  // inscribed in the bounding box, as a fraction of its radius.
  final c = box.center;
  final rx = max(box.width / 2, 1.0);
  final ry = max(box.height / 2, 1.0);
  var error = 0.0;
  for (final p in points) {
    final nx = (p.dx - c.dx) / rx;
    final ny = (p.dy - c.dy) / ry;
    error += (sqrt(nx * nx + ny * ny) - 1).abs();
  }
  error /= points.length;
  if (error <= 0.16) {
    final round = (rx - ry).abs() / max(rx, ry) < 0.18;
    final r = round ? (rx + ry) / 2 : null;
    return _ellipse(c, r ?? rx, r ?? ry);
  }
  return null;
}

/// Corner points of a closed stroke, by Ramer-Douglas-Peucker at [tolerance].
/// The closing point is dropped, so a square comes back as four corners.
List<Offset> _corners(List<Offset> points, double tolerance) {
  // Start the traversal from the point farthest from the first, so the
  // stroke's own start is not mistaken for a corner.
  final start = points.first;
  var far = 0;
  var farD = 0.0;
  for (var i = 0; i < points.length; i++) {
    final d = (points[i] - start).distance;
    if (d > farD) { farD = d; far = i; }
  }
  final a = _rdp(points.sublist(0, far + 1), tolerance);
  final b = _rdp(points.sublist(far), tolerance);
  final merged = [...a, ...b.skip(1)];
  // Drop the closing point if it lands back on the first corner.
  if (merged.length > 2 && (merged.last - merged.first).distance <= tolerance * 2) {
    merged.removeLast();
  }
  // Drop nearly-straight "corners" that RDP keeps because of a wobble.
  final out = <Offset>[];
  for (var i = 0; i < merged.length; i++) {
    final prev = merged[(i - 1 + merged.length) % merged.length];
    final next = merged[(i + 1) % merged.length];
    final turn = _turnAngle(prev, merged[i], next);
    if (turn > pi / 6) out.add(merged[i]);
  }
  return out;
}

bool _isRectangular(List<Offset> corners) {
  for (var i = 0; i < 4; i++) {
    final turn = _turnAngle(corners[(i + 3) % 4], corners[i], corners[(i + 1) % 4]);
    if ((turn - pi / 2).abs() > pi / 6) return false;
  }
  return true;
}

/// The angle turned at [b] going a -> b -> c, 0 for straight on.
double _turnAngle(Offset a, Offset b, Offset c) {
  final v1 = b - a;
  final v2 = c - b;
  if (v1.distance == 0 || v2.distance == 0) return 0;
  final cosT = (v1.dx * v2.dx + v1.dy * v2.dy) / (v1.distance * v2.distance);
  return acos(cosT.clamp(-1.0, 1.0));
}

List<Offset> _rdp(List<Offset> points, double tolerance) {
  if (points.length < 3) return points;
  final keep = List<bool>.filled(points.length, false);
  keep[0] = true;
  keep[points.length - 1] = true;
  final stack = <List<int>>[[0, points.length - 1]];
  while (stack.isNotEmpty) {
    final range = stack.removeLast();
    final first = range[0];
    final last = range[1];
    if (last <= first + 1) continue;
    var worst = 0.0;
    var worstAt = first;
    for (var i = first + 1; i < last; i++) {
      final d = _distanceToSegment(points[i], points[first], points[last]);
      if (d > worst) { worst = d; worstAt = i; }
    }
    if (worst > tolerance) {
      keep[worstAt] = true;
      stack.add([first, worstAt]);
      stack.add([worstAt, last]);
    }
  }
  return [for (var i = 0; i < points.length; i++) if (keep[i]) points[i]];
}

double _distanceToSegment(Offset p, Offset a, Offset b) {
  final ab = b - a;
  final len2 = ab.dx * ab.dx + ab.dy * ab.dy;
  if (len2 == 0) return (p - a).distance;
  final t = (((p - a).dx * ab.dx + (p - a).dy * ab.dy) / len2).clamp(0.0, 1.0);
  return (p - (a + ab * t)).distance;
}

Rect _bounds(List<Offset> points) {
  var minX = double.infinity, minY = double.infinity;
  var maxX = -double.infinity, maxY = -double.infinity;
  for (final p in points) {
    minX = min(minX, p.dx); minY = min(minY, p.dy);
    maxX = max(maxX, p.dx); maxY = max(maxY, p.dy);
  }
  return Rect.fromLTRB(minX, minY, maxX, maxY);
}

// --- stamps ------------------------------------------------------------------

/// A perfect [shape] filling [box], as a closed (or, for the arrow, open)
/// polyline. Dense enough on curves that a round thing looks round at full
/// canvas size.
List<Offset> stampPoints(StampShape shape, Rect box) {
  final b = box.width < 2 || box.height < 2
      ? Rect.fromCenter(center: box.center, width: max(box.width, 2), height: max(box.height, 2))
      : box;
  final c = b.center;
  final rx = b.width / 2;
  final ry = b.height / 2;
  switch (shape) {
    case StampShape.circle:
      return _ellipse(c, rx, ry);
    case StampShape.square:
      return [b.topLeft, b.topRight, b.bottomRight, b.bottomLeft, b.topLeft];
    case StampShape.triangle:
      return [b.topCenter, b.bottomRight, b.bottomLeft, b.topCenter];
    case StampShape.star:
      final out = <Offset>[];
      for (var i = 0; i < 10; i++) {
        final a = -pi / 2 + i * pi / 5;
        final k = i.isEven ? 1.0 : 0.45;
        out.add(Offset(c.dx + cos(a) * rx * k, c.dy + sin(a) * ry * k));
      }
      return [...out, out.first];
    case StampShape.heart:
      // Two lobes and a point, on a parametric heart curve.
      final out = <Offset>[];
      for (var i = 0; i <= 64; i++) {
        final t = i / 64 * 2 * pi;
        final x = 16 * pow(sin(t), 3);
        final y = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t);
        out.add(Offset(c.dx + x / 16 * rx, c.dy - (y - 1) / 15.5 * ry));
      }
      return out;
    case StampShape.arrow:
      // Shaft along the box's long axis, head at the far end.
      final horizontal = b.width >= b.height;
      final head = 0.35;
      if (horizontal) {
        final y = c.dy;
        final tip = Offset(b.right, y);
        final neck = Offset(b.right - b.width * head, y);
        return [
          Offset(b.left, y), tip, Offset(neck.dx, b.top), tip, Offset(neck.dx, b.bottom), tip,
        ];
      }
      final x = c.dx;
      final tip = Offset(x, b.bottom);
      final neck = Offset(x, b.bottom - b.height * head);
      return [
        Offset(x, b.top), tip, Offset(b.left, neck.dy), tip, Offset(b.right, neck.dy), tip,
      ];
    case StampShape.cloud:
      // A ring of bumps around an ellipse.
      final out = <Offset>[];
      const bumps = 7;
      for (var i = 0; i <= 140; i++) {
        final t = i / 140 * 2 * pi;
        final bump = 1 + 0.16 * cos(t * bumps).abs() * 1.4;
        out.add(Offset(c.dx + cos(t) * rx * 0.82 * bump, c.dy + sin(t) * ry * 0.82 * bump));
      }
      return out;
  }
}

List<Offset> _ellipse(Offset c, double rx, double ry) {
  final n = (max(rx, ry) / 3).clamp(24, 96).toInt();
  return [
    for (var i = 0; i <= n; i++)
      Offset(c.dx + cos(i / n * 2 * pi) * rx, c.dy + sin(i / n * 2 * pi) * ry),
  ];
}
