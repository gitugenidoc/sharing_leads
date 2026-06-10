import 'package:flutter/material.dart';

import 'section_card.dart';

class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    this.caption,
    this.trailing,
  });

  final String label;
  final String value;
  final String? caption;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          Text(value, style: Theme.of(context).textTheme.headlineMedium),
          if (caption != null) ...[
            const SizedBox(height: 10),
            Text(caption!, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}
