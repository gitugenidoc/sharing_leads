import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import 'contacts_screen.dart';
import 'dashboard_screen.dart';
import 'leads_screen.dart';
import 'pipeline_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.repository,
    required this.userInitials,
    required this.onLogout,
  });

  final AppRepository repository;
  final String userInitials;
  final VoidCallback onLogout;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      DashboardScreen(repository: widget.repository, avatarLabel: widget.userInitials),
      LeadsScreen(repository: widget.repository, avatarLabel: widget.userInitials),
      ContactsScreen(repository: widget.repository, avatarLabel: widget.userInitials),
      PipelineScreen(repository: widget.repository, avatarLabel: widget.userInitials),
    ];

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFF3F8FF), Color(0xFFE4F0FF)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: IndexedStack(
            index: selectedIndex,
            children: screens,
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.small(
        onPressed: widget.onLogout,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF17375A),
        child: const Icon(Icons.logout_rounded),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          setState(() {
            selectedIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.adjust_outlined), selectedIcon: Icon(Icons.adjust_rounded), label: 'Leads'),
          NavigationDestination(icon: Icon(Icons.people_outline_rounded), selectedIcon: Icon(Icons.people_rounded), label: 'Contacts'),
          NavigationDestination(icon: Icon(Icons.pie_chart_outline_rounded), selectedIcon: Icon(Icons.pie_chart_rounded), label: 'Pipeline'),
        ],
      ),
    );
  }
}
