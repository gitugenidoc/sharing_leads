import 'dart:io';

class AppConfig {
  static const appName = 'Force Commerciale Terrain';

  static String get apiBaseUrl {
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:4100/api/v1';
    }
    return 'http://localhost:4100/api/v1';
  }
}
