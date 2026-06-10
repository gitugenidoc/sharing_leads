import 'package:flutter/material.dart';

import 'activity_item.dart';

class DashboardSummary {
  const DashboardSummary({
    required this.cards,
    required this.leadStatuses,
    required this.activities,
  });

  final List<DashboardCardItem> cards;
  final Map<String, int> leadStatuses;
  final List<ActivityItem> activities;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    final statuses = (json['leadStatuses'] as Map<String, dynamic>? ?? {})
        .map((key, value) => MapEntry(key, (value as num).toInt()));

    return DashboardSummary(
      cards: ((json['cards'] as List<dynamic>? ?? const []))
          .map((item) => DashboardCardItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      leadStatuses: statuses,
      activities: ((json['activities'] as List<dynamic>? ?? const []))
          .map((item) => ActivityItem.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  List<DashboardSlice> get slices {
    const palette = [
      Color(0xFF204E86),
      Color(0xFF5E8FC7),
      Color(0xFF9BC4EB),
      Color(0xFFD8E8F8),
    ];

    final entries = leadStatuses.entries.toList();
    return entries.asMap().entries.map((entry) {
      final statusEntry = entry.value;
      return DashboardSlice(
        label: _beautify(statusEntry.key),
        value: statusEntry.value.toDouble(),
        color: palette[entry.key % palette.length],
      );
    }).toList();
  }

  String _beautify(String raw) {
    const labels = {
      'new': 'Nouveau',
      'in_progress': 'En cours',
      'no_answer': 'Sans reponse',
      'qualified': 'Qualifie',
      'won': 'Gagne',
      'lost': 'Perdu',
    };

    if (labels.containsKey(raw)) {
      return labels[raw]!;
    }

    return raw
        .split('_')
        .map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }
}

class DashboardCardItem {
  const DashboardCardItem({
    required this.id,
    required this.label,
    required this.value,
    required this.trend,
    required this.unit,
  });

  final String id;
  final String label;
  final num value;
  final num trend;
  final String unit;

  factory DashboardCardItem.fromJson(Map<String, dynamic> json) {
    return DashboardCardItem(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      value: json['value'] as num? ?? 0,
      trend: json['trend'] as num? ?? 0,
      unit: json['unit'] as String? ?? '',
    );
  }
}

class DashboardSlice {
  const DashboardSlice({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final double value;
  final Color color;
}
