class PipelineStageSummary {
  const PipelineStageSummary({
    required this.label,
    required this.count,
    required this.valueLabel,
  });

  final String label;
  final int count;
  final String valueLabel;

  factory PipelineStageSummary.fromJson(Map<String, dynamic> json) {
    const labels = {
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

    final rawStage = json['stage'] as String? ?? 'NOUVEAU_LEAD';
    final stage = labels[rawStage] ?? rawStage;
    final potential = (json['annualPotential'] as num? ?? 0).toStringAsFixed(0);

    return PipelineStageSummary(
      label: stage,
      count: (json['count'] as num? ?? 0).toInt(),
      valueLabel: 'MAD $potential',
    );
  }
}
