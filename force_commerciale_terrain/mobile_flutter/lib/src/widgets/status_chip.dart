import 'package:flutter/material.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
  });

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = _resolveTheme(label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: theme.$1,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: theme.$2,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  (Color, Color) _resolveTheme(String value) {
    switch (value.toLowerCase()) {
      case 'new':
      case 'nouveau':
        return (const Color(0xFFE9F3FF), const Color(0xFF2D6FC8));
      case 'in progress':
      case 'en cours':
      case 'qualified':
      case 'qualifie':
        return (const Color(0xFFFFF0DD), const Color(0xFFE48B00));
      case 'no answer':
      case 'sans reponse':
        return (const Color(0xFFF0E7FF), const Color(0xFF7A4DCC));
      case 'won':
      case 'gagne':
      case 'converted':
        return (const Color(0xFFE2F7EA), const Color(0xFF169B5F));
      case 'lost':
      case 'perdu':
        return (const Color(0xFFFDE8E8), const Color(0xFFCC3D3D));
      default:
        return (const Color(0xFFEEF2F7), const Color(0xFF5D738C));
    }
  }
}
