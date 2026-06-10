import '../models/activity_item.dart';
import '../models/auth_session.dart';
import '../models/contact.dart';
import '../models/dashboard_summary.dart';
import '../models/lead.dart';
import '../models/lead_detail_bundle.dart';
import '../models/pipeline_stage_summary.dart';
import '../services/api_client.dart';

class AppRepository {
  AppRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<AuthSession> bootstrapAdmin({
    required String fullName,
    required String email,
    required String password,
    String? phoneNumber,
  }) async {
    final data = await _apiClient.post(
      '/auth/bootstrap',
      body: {
        'fullName': fullName,
        'email': email,
        'password': password,
        'phoneNumber': phoneNumber,
      },
    );

    final session = AuthSession.fromJson(data as Map<String, dynamic>);
    _apiClient.setAccessToken(session.accessToken);
    return session;
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final data = await _apiClient.post(
      '/auth/login',
      body: {
        'email': email,
        'password': password,
      },
    );

    final session = AuthSession.fromJson(data as Map<String, dynamic>);
    _apiClient.setAccessToken(session.accessToken);
    return session;
  }

  void useToken(String? token) {
    _apiClient.setAccessToken(token);
  }

  Future<DashboardSummary> fetchDashboardSummary() async {
    final data = await _apiClient.get('/dashboard/summary');
    return DashboardSummary.fromJson(data as Map<String, dynamic>);
  }

  Future<List<Lead>> fetchLeads({String search = ''}) async {
    final suffix = search.isEmpty ? '' : '?search=${Uri.encodeQueryComponent(search)}';
    final data = await _apiClient.get('/leads$suffix');
    return (data as List<dynamic>)
        .map((item) => Lead.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<LeadDetailBundle> fetchLeadDetail(String leadId) async {
    final data = await _apiClient.get('/leads/$leadId');
    return LeadDetailBundle.fromJson(data as Map<String, dynamic>);
  }

  Future<List<Contact>> fetchContacts({String search = ''}) async {
    final suffix = search.isEmpty ? '' : '?search=${Uri.encodeQueryComponent(search)}';
    final data = await _apiClient.get('/contacts$suffix');
    return (data as List<dynamic>)
        .map((item) => Contact.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<PipelineStageSummary>> fetchPipelineSummary() async {
    final data = await _apiClient.get('/pipeline/summary');
    return (data as List<dynamic>)
        .map((item) => PipelineStageSummary.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<ActivityItem>> fetchActivities({String? leadId}) async {
    final suffix = leadId == null ? '' : '?leadId=${Uri.encodeQueryComponent(leadId)}';
    final data = await _apiClient.get('/activities$suffix');
    return (data as List<dynamic>)
        .map((item) => ActivityItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
