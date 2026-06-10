import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import '../models/lead.dart';
import '../models/lead_detail_bundle.dart';
import '../widgets/app_header.dart';
import '../widgets/empty_state_card.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';

class LeadDetailScreen extends StatelessWidget {
  const LeadDetailScreen({
    super.key,
    required this.repository,
    required this.lead,
    required this.avatarLabel,
  });

  final AppRepository repository;
  final Lead lead;
  final String avatarLabel;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEAF3FF),
      body: SafeArea(
        child: FutureBuilder<LeadDetailBundle>(
          future: repository.fetchLeadDetail(lead.id),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snapshot.hasError) {
              return Center(child: Text(snapshot.error.toString(), textAlign: TextAlign.center));
            }

            final bundle = snapshot.data ??
                LeadDetailBundle(
                  lead: lead,
                  activities: const [],
                  tasksCount: 0,
                  visitsCount: 0,
                  callEventsCount: 0,
                );

            return ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                AppHeader(
                  title: bundle.lead.fullName,
                  subtitle: bundle.lead.companyName,
                  avatarLabel: avatarLabel,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text('Lead overview', style: Theme.of(context).textTheme.titleMedium),
                            ),
                            StatusChip(label: bundle.lead.status),
                          ],
                        ),
                        const SizedBox(height: 18),
                        _DetailRow(label: 'Name', value: bundle.lead.fullName),
                        _DetailRow(label: 'Stage', value: bundle.lead.stage),
                        _DetailRow(label: 'Annual potential', value: 'MAD ${bundle.lead.annualPotential}'),
                        _DetailRow(label: 'Next action', value: bundle.lead.nextActionLabel),
                        _DetailRow(label: 'Source', value: bundle.lead.source.isEmpty ? 'Not set' : bundle.lead.source),
                        _DetailRow(label: 'City', value: bundle.lead.city.isEmpty ? 'Not set' : bundle.lead.city),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: SectionCard(
                    child: Row(
                      children: [
                        Expanded(child: _MetricBox(label: 'Tasks', value: '${bundle.tasksCount}')),
                        const SizedBox(width: 12),
                        Expanded(child: _MetricBox(label: 'Visits', value: '${bundle.visitsCount}')),
                        const SizedBox(width: 12),
                        Expanded(child: _MetricBox(label: 'Calls', value: '${bundle.callEventsCount}')),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: bundle.activities.isEmpty
                      ? const EmptyStateCard(
                          title: 'No activity yet',
                          message: 'Aucune note, visite ou appel n\'est encore rattache a ce lead.',
                        )
                      : SectionCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Activity timeline', style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 16),
                              ...bundle.activities.map(
                                (activity) => Padding(
                                  padding: const EdgeInsets.only(bottom: 14),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 10,
                                        height: 10,
                                        margin: const EdgeInsets.only(top: 6),
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF204E86),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              activity.title,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF17375A),
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              activity.description ?? '',
                                              style: Theme.of(context).textTheme.bodyMedium,
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(activity.timeLabel, style: Theme.of(context).textTheme.bodyMedium),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Color(0xFF17375A), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricBox extends StatelessWidget {
  const _MetricBox({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFD),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE4ECF5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(color: Color(0xFF17375A), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
