import 'package:flutter/material.dart';

/// Normalized to the 0..1 range so a drawing looks the same regardless of
/// which device's screen size it was drawn or rendered on.
class Point {
  const Point(this.x, this.y);

  final double x;
  final double y;

  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  factory Point.fromJson(Map<String, dynamic> json) =>
      Point((json['x'] as num).toDouble(), (json['y'] as num).toDouble());
}

class Stroke {
  const Stroke({required this.color, required this.width, required this.points});

  final Color color;
  final double width;
  final List<Point> points;

  Map<String, dynamic> toJson() => {
        'color': _colorToHex(color),
        'width': width,
        'points': points.map((p) => p.toJson()).toList(),
      };

  factory Stroke.fromJson(Map<String, dynamic> json) => Stroke(
        color: _colorFromHex(json['color'] as String),
        width: (json['width'] as num).toDouble(),
        points: (json['points'] as List)
            .map((p) => Point.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}

String _colorToHex(Color color) {
  final r = (color.r * 255).round().toRadixString(16).padLeft(2, '0');
  final g = (color.g * 255).round().toRadixString(16).padLeft(2, '0');
  final b = (color.b * 255).round().toRadixString(16).padLeft(2, '0');
  return '#$r$g$b';
}

Color _colorFromHex(String hex) {
  final cleaned = hex.replaceFirst('#', '');
  return Color(int.parse('ff$cleaned', radix: 16));
}
