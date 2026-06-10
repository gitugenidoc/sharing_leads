import 'package:flutter/material.dart';

import '../data/app_repository.dart';
import '../models/auth_session.dart';
import '../widgets/segmented_tabs.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.repository,
    required this.onAuthenticated,
  });

  final AppRepository repository;
  final ValueChanged<AuthSession> onAuthenticated;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  int selectedTab = 0;
  bool submitting = false;
  String? errorMessage;

  final bootstrapNameController = TextEditingController();
  final bootstrapEmailController = TextEditingController();
  final bootstrapPasswordController = TextEditingController();
  final bootstrapPhoneController = TextEditingController();

  final loginEmailController = TextEditingController();
  final loginPasswordController = TextEditingController();

  @override
  void dispose() {
    bootstrapNameController.dispose();
    bootstrapEmailController.dispose();
    bootstrapPasswordController.dispose();
    bootstrapPhoneController.dispose();
    loginEmailController.dispose();
    loginPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const SizedBox(height: 24),
              Text('Force Commerciale', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Base vide au depart. Cree l\'admin une seule fois, puis connecte-toi.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              SegmentedTabs(
                labels: const ['Setup', 'Login'],
                selectedIndex: selectedTab,
                onChanged: (index) {
                  setState(() {
                    selectedTab = index;
                    errorMessage = null;
                  });
                },
              ),
              const SizedBox(height: 24),
              if (selectedTab == 0) ...[
                TextField(
                  controller: bootstrapNameController,
                  decoration: const InputDecoration(hintText: 'Full name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bootstrapEmailController,
                  decoration: const InputDecoration(hintText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bootstrapPhoneController,
                  decoration: const InputDecoration(hintText: 'Phone number'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bootstrapPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(hintText: 'Password'),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: submitting ? null : _bootstrap,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text(submitting ? 'Please wait...' : 'Create admin'),
                  ),
                ),
              ] else ...[
                TextField(
                  controller: loginEmailController,
                  decoration: const InputDecoration(hintText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: loginPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(hintText: 'Password'),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: submitting ? null : _login,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text(submitting ? 'Please wait...' : 'Login'),
                  ),
                ),
              ],
              if (errorMessage != null) ...[
                const SizedBox(height: 16),
                Text(
                  errorMessage!,
                  style: const TextStyle(
                    color: Color(0xFFC62828),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _bootstrap() async {
    setState(() {
      submitting = true;
      errorMessage = null;
    });
    try {
      final session = await widget.repository.bootstrapAdmin(
        fullName: bootstrapNameController.text.trim(),
        email: bootstrapEmailController.text.trim(),
        password: bootstrapPasswordController.text,
        phoneNumber: bootstrapPhoneController.text.trim(),
      );
      widget.onAuthenticated(session);
    } catch (error) {
      setState(() {
        errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          submitting = false;
        });
      }
    }
  }

  Future<void> _login() async {
    setState(() {
      submitting = true;
      errorMessage = null;
    });
    try {
      final session = await widget.repository.login(
        email: loginEmailController.text.trim(),
        password: loginPasswordController.text,
      );
      widget.onAuthenticated(session);
    } catch (error) {
      setState(() {
        errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          submitting = false;
        });
      }
    }
  }
}
