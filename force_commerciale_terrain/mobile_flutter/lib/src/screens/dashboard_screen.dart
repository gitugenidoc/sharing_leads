import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import '../models/dashboard_summary.dart';
import '../widgets/app_header.dart';
import '../widgets/empty_state_card.dart';
import '../widgets/metric_card.dart';
import '../widgets/ring_chart.dart';
import '../widgets/section_card.dart';
import '../widgets/segmented_tabs.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.repository,
    required this.avatarLabel,
  });

  final AppRepository repository;
  final String avatarLabel;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int selectedTab = 0;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DashboardSummary>(
      future: widget.repository.fetchDashboardSummary(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return _ErrorView(message: snapshot.error.toString());
        }

        final summary = snapshot.data ??
            const DashboardSummary(cards: [], leadStatuses: {}, activities: []);

        return ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            AppHeader(title: 'Dashboard', avatarLabel: widget.avatarLabel),
            SegmentedTabs(
              labels: const ['Home', 'My Tier', 'Activities'],
              selectedIndex: selectedTab,
              onChanged: (index) {
                setState(() {
                  selectedTab = index;
                });
              },
            ),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: MetricCard(
                label: 'Current Annual Income',
                value: _cardValue(summary, 'income'),
                caption: 'Pipeline realized value',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2F7EA),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    '+0%',
                    style: TextStyle(
                      color: Color(0xFF169B5F),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SectionCard(
                child: summary.slices.isEmpty
                    ? const EmptyStateCard(
                        title: 'No statistics yet',
                        message:
                            'La base est vide. Les segments du dashboard apparaitront apres creation des premiers leads.',
                      )
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          RingChart(slices: summary.slices),
                          const SizedBox(width: 18),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: summary.slices
                                  .map(
                                    (slice) => Padding(
                                      padding: const EdgeInsets.only(bottom: 12),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 10,
                                            height: 10,
                                            decoration: BoxDecoration(
                                              color: slice.color,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              slice.label,
                                              style: Theme.of(context).textTheme.bodyMedium,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: summary.activities.isEmpty
                  ? const EmptyStateCard(
                      title: 'No activity yet',
                      message: 'Les appels, changements de statut et taches apparaitront ici.',
                    )
                  : SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Today Activity', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 16),
                          ...summary.activities.map(
                            (activity) => Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: Row(
                                children: [
                                  Container(
                                    width: 42,
                                    height: 42,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEAF3FF),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: const Icon(
                                      Icons.bolt_rounded,
                                      color: Color(0xFF204E86),
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
                                        const SizedBox(height: 2),
                                        Text(
                                          activity.description ?? '',
                                          style: Theme.of(context).textTheme.bodyMedium,
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    activity.timeLabel,
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
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
    );
  }

  String _cardValue(DashboardSummary summary, String id) {
    for (final card in summary.cards) {
      if (card.id == id) {
        return card.unit == 'MAD' ? 'MAD ${card.value}' : card.value.toString();
      }
    }
    return '0';
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Text(message, textAlign: TextAlign.center),
      ),
    );
  }
}
