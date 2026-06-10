class Contact {
  const Contact({
    required this.id,
    required this.name,
    required this.company,
    required this.role,
    required this.phoneNumber,
    required this.email,
    required this.status,
  });

  final String id;
  final String name;
  final String company;
  final String role;
  final String phoneNumber;
  final String email;
  final String status;

  factory Contact.fromJson(Map<String, dynamic> json) {
    return Contact(
      id: json['id'] as String? ?? '',
      name: json['fullName'] as String? ?? '',
      company: json['companyName'] as String? ?? '',
      role: json['roleTitle'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      email: json['email'] as String? ?? '',
      status: json['status'] as String? ?? 'NEW',
    );
  }
}
