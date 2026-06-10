import 'package:flutter/material.dart';

import '../models/lead.dart';
import 'status_chip.dart';

class LeadTile extends StatelessWidget {
  const LeadTile({
    super.key,
    required this.lead,
    required this.onTap,
  });

  final Lead lead;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Ink(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFE4ECF5)),
        ),
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: const Color(0xFFD5E8FA),
              child: Text(
                lead.initials,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF17375A),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          lead.fullName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF17375A),
                          ),
                        ),
                      ),
                      Text(lead.lastContactLabel, style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(lead.email, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 4),
                  Text(lead.phoneNumber, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 6),
                  Text(
                    lead.notesSummary.isEmpty ? 'No notes yet' : lead.notesSummary,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 10),
                  StatusChip(label: lead.status),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
