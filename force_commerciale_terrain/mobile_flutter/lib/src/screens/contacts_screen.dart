import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import '../models/contact.dart';
import '../widgets/app_header.dart';
import '../widgets/empty_state_card.dart';
import '../widgets/section_card.dart';
import '../widgets/status_chip.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({
    super.key,
    required this.repository,
    required this.avatarLabel,
  });

  final AppRepository repository;
  final String avatarLabel;

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final TextEditingController searchController = TextEditingController();

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        AppHeader(title: 'Contacts', avatarLabel: widget.avatarLabel),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: TextField(
            controller: searchController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Search contacts or companies',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: FutureBuilder<List<Contact>>(
            future: widget.repository.fetchContacts(search: searchController.text.trim()),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) {
                return Center(child: Text(snapshot.error.toString(), textAlign: TextAlign.center));
              }

              final contacts = snapshot.data ?? const <Contact>[];
              if (contacts.isEmpty) {
                return const EmptyStateCard(
                  title: 'No contacts yet',
                  message: 'Aucun contact n\'est encore en base.',
                );
              }

              return SectionCard(
                child: Column(
                  children: contacts
                      .map(
                        (contact) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: const Color(0xFFEAF3FF),
                                child: Text(
                                  contact.name
                                      .split(' ')
                                      .where((part) => part.isNotEmpty)
                                      .map((part) => part[0])
                                      .take(2)
                                      .join(),
                                  style: const TextStyle(
                                    color: Color(0xFF204E86),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      contact.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF17375A),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${contact.company} • ${contact.role}',
                                      style: Theme.of(context).textTheme.bodyMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${contact.phoneNumber} • ${contact.email}',
                                      style: Theme.of(context).textTheme.bodyMedium,
                                    ),
                                  ],
                                ),
                              ),
                              StatusChip(label: contact.status),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
