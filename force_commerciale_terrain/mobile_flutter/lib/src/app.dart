import 'package:flutter/material.dart';

import 'data/app_repository.dart';
import 'models/auth_session.dart';
import 'screens/auth_screen.dart';
import 'screens/home_shell.dart';
import 'theme/app_theme.dart';

class FieldSalesApp extends StatefulWidget {
  const FieldSalesApp({super.key});

  @override
  State<FieldSalesApp> createState() => _FieldSalesAppState();
}

class _FieldSalesAppState extends State<FieldSalesApp> {
  final AppRepository repository = AppRepository();
  AuthSession? session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Force Commerciale Terrain',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: session == null
          ? AuthScreen(
              repository: repository,
              onAuthenticated: _handleAuthenticated,
            )
          : HomeShell(
              repository: repository,
              userInitials: session!.user.initials,
              onLogout: _handleLogout,
            ),
    );
  }

  void _handleAuthenticated(AuthSession newSession) {
    repository.useToken(newSession.accessToken);
    setState(() {
      session = newSession;
    });
  }

  void _handleLogout() {
    repository.useToken(null);
    setState(() {
      session = null;
    });
  }
}
