import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/dashboard_summary.dart';

class RingChart extends StatelessWidget {
  const RingChart({
    super.key,
    required this.slices,
  });

  final List<DashboardSlice> slices;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size.square(148),
      painter: _RingChartPainter(slices),
      child: const SizedBox(width: 148, height: 148),
    );
  }
}

class _RingChartPainter extends CustomPainter {
  _RingChartPainter(this.slices);

  final List<DashboardSlice> slices;

  @override
  void paint(Canvas canvas, Size size) {
    const strokeWidth = 18.0;
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = math.min(size.width, size.height) / 2 - strokeWidth;
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    var startAngle = -math.pi / 2;

    final backgroundPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = const Color(0xFFE7EFF8)
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, backgroundPaint);

    if (total == 0) {
      return;
    }

    for (final slice in slices) {
      final sweep = (slice.value / total) * math.pi * 2;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..color = slice.color
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweep,
        false,
        paint,
      );
      startAngle += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _RingChartPainter oldDelegate) {
    return oldDelegate.slices != slices;
  }
}
