import 'package:intl/intl.dart';

class Lead {
  const Lead({
    required this.id,
    required this.initials,
    required this.fullName,
    required this.phoneNumber,
    required this.email,
    required this.companyName,
    required this.city,
    required this.status,
    required this.stage,
    required this.notesSummary,
    required this.annualPotential,
    required this.lastContactLabel,
    required this.nextActionLabel,
    required this.source,
  });

  final String id;
  final String initials;
  final String fullName;
  final String phoneNumber;
  final String email;
  final String companyName;
  final String city;
  final String status;
  final String stage;
  final String notesSummary;
  final num annualPotential;
  final String lastContactLabel;
  final String nextActionLabel;
  final String source;

  factory Lead.fromJson(Map<String, dynamic> json) {
    return Lead(
      id: json['id'] as String? ?? '',
      initials: _initials(json['fullName'] as String? ?? ''),
      fullName: json['fullName'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      email: json['email'] as String? ?? '',
      companyName: json['companyName'] as String? ?? '',
      city: json['city'] as String? ?? '',
      status: _beautify(json['status'] as String? ?? 'NEW'),
      stage: _beautify(json['stage'] as String? ?? 'NOUVEAU_LEAD'),
      notesSummary: json['notesSummary'] as String? ?? '',
      annualPotential: json['annualPotential'] as num? ?? 0,
      lastContactLabel: _formatDate(json['lastContactAt']),
      nextActionLabel: _formatDate(json['nextActionAt']),
      source: json['source'] as String? ?? '',
    );
  }

  static String _initials(String name) {
    return name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase())
        .take(2)
        .join();
  }

  static String _beautify(String raw) {
    const labels = {
      'NEW': 'Nouveau',
      'IN_PROGRESS': 'En cours',
      'NO_ANSWER': 'Sans reponse',
      'QUALIFIED': 'Qualifie',
      'WON': 'Gagne',
      'LOST': 'Perdu',
      'NOUVEAU_LEAD': 'Nouveau Lead',
      'QUALIFICATION': 'Qualification',
      'PREMIER_CONTACT': 'Premier Contact',
      'ANALYSE_DU_BESOIN': 'Analyse du Besoin',
      'OPPORTUNITE': 'Opportunite',
      'PROPOSITION': 'Proposition',
      'NEGOTIATION': 'Negociation',
      'GAGNE': 'Gagne',
      'PERDU': 'Perdu',
      'ONBOARDING': 'Onboarding',
      'FIDELISATION': 'Fidelisation',
    };

    if (labels.containsKey(raw)) {
      return labels[raw]!;
    }

    return raw
        .split('_')
        .map((part) => part.isEmpty ? part : '${part[0]}${part.substring(1).toLowerCase()}')
        .join(' ');
  }

  static String _formatDate(dynamic raw) {
    final parsed = DateTime.tryParse((raw ?? '').toString());
    if (parsed == null) {
      return 'Not scheduled';
    }
    return DateFormat('dd MMM HH:mm').format(parsed);
  }
}
