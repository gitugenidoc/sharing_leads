import 'activity_item.dart';
import 'lead.dart';

class LeadDetailBundle {
  const LeadDetailBundle({
    required this.lead,
    required this.activities,
    required this.tasksCount,
    required this.visitsCount,
    required this.callEventsCount,
  });

  final Lead lead;
  final List<ActivityItem> activities;
  final int tasksCount;
  final int visitsCount;
  final int callEventsCount;

  factory LeadDetailBundle.fromJson(Map<String, dynamic> json) {
    return LeadDetailBundle(
      lead: Lead.fromJson(json),
      activities: ((json['activities'] as List<dynamic>? ?? const []))
          .map((item) => ActivityItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      tasksCount: (json['tasks'] as List<dynamic>? ?? const []).length,
      visitsCount: (json['visits'] as List<dynamic>? ?? const []).length,
      callEventsCount: (json['callEvents'] as List<dynamic>? ?? const []).length,
    );
  }
}
