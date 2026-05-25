# EXTERNAL_INTERFACE_MAP

Derived strictly from `lib/api-spec/openapi.yaml`.

| Method | Path | Operation | Auth |
|---|---|---|---|
| GET | /healthz | healthCheck | none |
| POST | /auth/register | registerUser | none |
| POST | /auth/login | loginUser | none |
| POST | /auth/logout | logoutUser | session-cookie (inferred) |
| GET | /auth/me | getCurrentUser | session-cookie (inferred) |
| GET | /tenants/me | getMyTenant | session-cookie (inferred) |
| PATCH | /tenants/me | updateMyTenant | session-cookie (inferred) |
| GET | /dashboard | getDashboard | session-cookie (inferred) |
| GET | /clients | listClients | session-cookie (inferred) |
| POST | /clients | createClient | session-cookie (inferred) |
| GET | /clients/{id} | getClient | session-cookie (inferred) |
| PATCH | /clients/{id} | updateClient | session-cookie (inferred) |
| DELETE | /clients/{id} | deleteClient | session-cookie (inferred) |
| GET | /projects | listProjects | session-cookie (inferred) |
| POST | /projects | createProject | session-cookie (inferred) |
| GET | /projects/{id} | getProject | session-cookie (inferred) |
| PATCH | /projects/{id} | updateProject | session-cookie (inferred) |
| DELETE | /projects/{id} | deleteProject | session-cookie (inferred) |
| GET | /projects/{projectId}/keywords | listKeywords | session-cookie (inferred) |
| POST | /projects/{projectId}/keywords | createKeyword | session-cookie (inferred) |
| POST | /projects/{projectId}/keywords/import | importKeywords | session-cookie (inferred) |
| GET | /projects/{projectId}/keywords/{id} | getKeyword | session-cookie (inferred) |
| PATCH | /projects/{projectId}/keywords/{id} | updateKeyword | session-cookie (inferred) |
| DELETE | /projects/{projectId}/keywords/{id} | deleteKeyword | session-cookie (inferred) |
| GET | /projects/{projectId}/score-settings | getScoreSettings | session-cookie (inferred) |
| PATCH | /projects/{projectId}/score-settings | updateScoreSettings | session-cookie (inferred) |
| GET | /projects/{projectId}/clusters | listClusters | session-cookie (inferred) |
| POST | /projects/{projectId}/clusters | createCluster | session-cookie (inferred) |
| POST | /projects/{projectId}/cluster-keywords | clusterKeywords | session-cookie (inferred) |
| GET | /projects/{projectId}/clusters/{id} | getCluster | session-cookie (inferred) |
| PATCH | /projects/{projectId}/clusters/{id} | updateCluster | session-cookie (inferred) |
| DELETE | /projects/{projectId}/clusters/{id} | deleteCluster | session-cookie (inferred) |
| POST | /projects/{projectId}/clusters/{id}/approve | approveCluster | session-cookie (inferred) |
| POST | /projects/{projectId}/clusters/{id}/reject | rejectCluster | session-cookie (inferred) |
| GET | /projects/{projectId}/topic-map | getTopicMap | session-cookie (inferred) |
| GET | /projects/{projectId}/roadmap | getContentRoadmap | session-cookie (inferred) |
| GET | /ai-tasks | listAiTasks | session-cookie (inferred) |
| GET | /ai-tasks/{id} | getAiTask | session-cookie (inferred) |
| GET | /projects/{projectId}/briefs | listBriefs | session-cookie (inferred) |
| POST | /projects/{projectId}/briefs | createBrief | session-cookie (inferred) |
| GET | /projects/{projectId}/briefs/{id} | getBrief | session-cookie (inferred) |
| PATCH | /projects/{projectId}/briefs/{id} | updateBrief | session-cookie (inferred) |
| DELETE | /projects/{projectId}/briefs/{id} | deleteBrief | session-cookie (inferred) |
| POST | /projects/{projectId}/briefs/{id}/generate | generateBrief | session-cookie (inferred) |
| POST | /projects/{projectId}/briefs/{id}/approve | approveBrief | session-cookie (inferred) |
| GET | /projects/{projectId}/reports | listReports | session-cookie (inferred) |
| POST | /projects/{projectId}/reports | generateReport | session-cookie (inferred) |
| GET | /projects/{projectId}/reports/{id} | getReport | session-cookie (inferred) |
| DELETE | /projects/{projectId}/reports/{id} | deleteReport | session-cookie (inferred) |
| GET | /billing/plans | listPlans | session-cookie (inferred) |
| GET | /billing/subscription | getSubscription | session-cookie (inferred) |
| POST | /billing/checkout | createCheckoutSession | session-cookie (inferred) |
| POST | /billing/portal | createBillingPortal | session-cookie (inferred) |
| GET | /billing/usage | getBillingUsage | session-cookie (inferred) |
