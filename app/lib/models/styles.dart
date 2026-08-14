/// Cosmetic styles for a drawing: what it's drawn *on*, and what it's drawn
/// *with*.
///
/// Both travel with the drawing to everyone else — the whole point is that
/// your entries look like yours when they come up in the presentation. Neither
/// affects scoring in any way.
library;

/// The sheet in the frame. All of them are light on purpose: a dark paper
/// would make the free black pen invisible, which would turn a cosmetic into
/// a trap.
enum PaperStyle {
  plain('plain', 'Plain'),
  graph('graph', 'Graph'),
  ruled('ruled', 'Ruled'),
  dots('dots', 'Dotted'),
  kraft('kraft', 'Kraft'),
  sticky('sticky', 'Sticky');

  const PaperStyle(this.id, this.label);

  final String id;
  final String label;

  /// Everyone gets this one.
  static const free = PaperStyle.plain;

  static PaperStyle fromId(String? id) =>
      PaperStyle.values.firstWhere((s) => s.id == id, orElse: () => PaperStyle.plain);
}

/// What the stroke looks like. Widths and colours are unchanged — this only
/// alters how the line is laid down.
enum PenStyle {
  pen('pen', 'Pen'),
  marker('marker', 'Marker'),
  crayon('crayon', 'Crayon'),
  pencil('pencil', 'Pencil'),
  brush('brush', 'Brush');

  const PenStyle(this.id, this.label);

  final String id;
  final String label;

  static const free = PenStyle.pen;

  static PenStyle fromId(String? id) =>
      PenStyle.values.firstWhere((s) => s.id == id, orElse: () => PenStyle.pen);
}
