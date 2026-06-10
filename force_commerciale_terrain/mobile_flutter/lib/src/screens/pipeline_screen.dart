import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import '../models/pipeline_stage_summary.dart';
import '../widgets/app_header.dart';
import '../widgets/empty_state_card.dart';
import '../widgets/section_card.dart';

class PipelineScreen extends StatelessWidget {
  const PipelineScreen({
    super.key,
    required this.repository,
    required this.avatarLabel,
  });

  final AppRepository repository;
  final String avatarLabel;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PipelineStageSummary>>(
      future: repository.fetchPipelineSummary(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(child: Text(snapshot.error.toString(), textAlign: TextAlign.center));
        }

        final pipeline = snapshot.data ?? const <PipelineStageSummary>[];

        return ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            AppHeader(
              title: 'Pipeline',
              subtitle: 'Field sales progression',
              avatarLabel: avatarLabel,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: pipeline.isEmpty
                  ? const EmptyStateCard(
                      title: 'No pipeline yet',
                      message: 'Le pipeline apparaitra apres creation et qualification des premiers leads.',
                    )
                  : SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Active pipeline', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 16),
                          ...pipeline.map(
                            (stage) => Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF7FAFD),
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: const Color(0xFFE4ECF5)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        stage.label,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF17375A),
                                        ),
                                      ),
                                    ),
                                    Text(
                                      '${stage.count} leads',
                                      style: Theme.of(context).textTheme.bodyMedium,
                                    ),
                                    const SizedBox(width: 16),
                                    Text(
                                      stage.valueLabel,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF204E86),
                                      ),
                                    ),
                                  ],
                                ),
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
}
