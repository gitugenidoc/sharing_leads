import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  String? _accessToken;

  void setAccessToken(String? token) {
    _accessToken = token;
  }

  Future<dynamic> get(String path) async {
    final response = await _client.get(_uri(path), headers: _headers());
    return _extractData(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final response = await _client.post(
      _uri(path),
      headers: _headers(),
      body: jsonEncode(body ?? const {}),
    );
    return _extractData(response);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final response = await _client.patch(
      _uri(path),
      headers: _headers(),
      body: jsonEncode(body ?? const {}),
    );
    return _extractData(response);
  }

  Uri _uri(String path) {
    return Uri.parse('${AppConfig.apiBaseUrl}$path');
  }

  Map<String, String> _headers() {
    return {
      'content-type': 'application/json',
      if (_accessToken != null) 'authorization': 'Bearer $_accessToken',
    };
  }

  dynamic _extractData(http.Response response) {
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400 || payload['success'] != true) {
      throw Exception(payload['message'] ?? 'API request failed');
    }
    return payload['data'];
  }
}
