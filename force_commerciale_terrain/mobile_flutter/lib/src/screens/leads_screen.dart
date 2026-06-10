import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import '../models/lead.dart';
import '../widgets/app_header.dart';
import '../widgets/empty_state_card.dart';
import '../widgets/lead_tile.dart';
import '../widgets/segmented_tabs.dart';
import 'lead_detail_screen.dart';

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({
    super.key,
    required this.repository,
    required this.avatarLabel,
  });

  final AppRepository repository;
  final String avatarLabel;

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  int selectedTab = 1;
  final TextEditingController searchController = TextEditingController();

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppHeader(title: 'Leads', avatarLabel: widget.avatarLabel),
        SegmentedTabs(
          labels: const ['Partners', 'Leads'],
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
          child: TextField(
            controller: searchController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Search',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: FutureBuilder<List<Lead>>(
            future: widget.repository.fetchLeads(search: searchController.text.trim()),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) {
                return Center(child: Text(snapshot.error.toString(), textAlign: TextAlign.center));
              }

              final leads = snapshot.data ?? const <Lead>[];
              if (leads.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.all(20),
                  child: EmptyStateCard(
                    title: 'No leads yet',
                    message: 'La base est vide. Cree le premier lead depuis le mobile ou le backoffice.',
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: leads.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (context, index) {
                  final lead = leads[index];
                  return LeadTile(
                    lead: lead,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => LeadDetailScreen(
                          repository: widget.repository,
                          lead: lead,
                          avatarLabel: widget.avatarLabel,
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
