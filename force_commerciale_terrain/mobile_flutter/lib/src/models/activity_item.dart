import 'package:intl/intl.dart';

class ActivityItem {
  const ActivityItem({
    required this.id,
    required this.leadId,
    required this.title,
    required this.description,
    required this.timeLabel,
    required this.type,
  });

  final String id;
  final String? leadId;
  final String title;
  final String? description;
  final String timeLabel;
  final String type;

  factory ActivityItem.fromJson(Map<String, dynamic> json) {
    final occurredAt = DateTime.tryParse(
      (json['occurredAt'] ?? json['createdAt'] ?? '').toString(),
    );

    return ActivityItem(
      id: json['id'] as String? ?? '',
      leadId: json['leadId'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      timeLabel: occurredAt != null ? DateFormat('HH:mm').format(occurredAt) : '--:--',
      type: (json['type'] as String? ?? '').toLowerCase(),
    );
  }
}
