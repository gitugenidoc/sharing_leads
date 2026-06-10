import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() {
    const primary = Color(0xFF204E86);
    const secondary = Color(0xFFE85D3F);
    const line = Color(0xFFE4ECF5);

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: const ColorScheme.light(
        primary: primary,
        secondary: secondary,
        surface: Color(0xFFF8FBFF),
      ),
      scaffoldBackgroundColor: const Color(0xFFEAF3FF),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: Color(0xFF143353),
        ),
        titleLarge: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: Color(0xFF17375A),
        ),
        titleMedium: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: Color(0xFF17375A),
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          color: Color(0xFF3A5572),
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          color: Color(0xFF56708C),
        ),
      ),
    );

    return base.copyWith(
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: const TextStyle(color: Color(0xFF8CA0B5)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: primary, width: 1.4),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        labelTextStyle: MaterialStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(MaterialState.selected)
                ? primary
                : const Color(0xFF8CA0B5),
            fontWeight: states.contains(MaterialState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
          ),
        ),
        indicatorColor: const Color(0xFFDCE9F8),
      ),
    );
  }
}
