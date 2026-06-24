import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DEMO = {
  tenantName: "RankMap GEO/AEO Demo Tenant",
  userEmail: "geo-aeo-demo-operator@example.test",
  userPassword: "RankMapDemo!123",
  passwordHash: "$2b$12$dr1o3QMF3KhlSZJzFH4D8uMJ3AzvNubKr4Rfr0DooBiv/Recnd3AK",
  clientName: "Atlas Local Care",
  projectName: "Atlas Local Care GEO/AEO Demo",
  websiteUrl: "https://atlaslocalcare.example.test",
  auditName: "Atlas Local Care AI Visibility Demo Audit",
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running db:seed.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashAnswer(answerText) {
  return crypto.createHash("sha256").update(answerText).digest("hex");
}

async function one(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] ?? null;
}

async function ensureTenant() {
  const existing = await one("select id from tenants where name = $1 limit 1", [DEMO.tenantName]);
  if (existing) {
    await pool.query(
      "update tenants set plan = 'agency', seats_used = 1, seats_max = 5 where id = $1",
      [existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    "insert into tenants (name, plan, seats_used, seats_max) values ($1, 'agency', 1, 5) returning id",
    [DEMO.tenantName],
  );
  return inserted.id;
}

async function ensureUser(tenantId) {
  const existing = await one("select id from users where email = $1 limit 1", [DEMO.userEmail]);
  if (existing) {
    await pool.query(
      "update users set tenant_id = $1, password_hash = $2, role = 'agency_admin', full_name = 'GEO/AEO Demo Operator' where id = $3",
      [tenantId, DEMO.passwordHash, existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    "insert into users (tenant_id, email, password_hash, role, full_name) values ($1, $2, $3, 'agency_admin', 'GEO/AEO Demo Operator') returning id",
    [tenantId, DEMO.userEmail, DEMO.passwordHash],
  );
  return inserted.id;
}

async function ensureClient(tenantId) {
  const existing = await one("select id from clients where tenant_id = $1 and name = $2 limit 1", [
    tenantId,
    DEMO.clientName,
  ]);
  if (existing) {
    await pool.query(
      "update clients set domain = 'atlaslocalcare.example.test', industry = 'Healthcare', is_active = true where id = $1",
      [existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    "insert into clients (tenant_id, name, domain, industry, is_active) values ($1, $2, 'atlaslocalcare.example.test', 'Healthcare', true) returning id",
    [tenantId, DEMO.clientName],
  );
  return inserted.id;
}

async function ensureProject(tenantId, clientId) {
  const existing = await one(
    "select id from projects where tenant_id = $1 and client_id = $2 and name = $3 limit 1",
    [tenantId, clientId, DEMO.projectName],
  );
  if (existing) {
    await pool.query(
      "update projects set target_domain = 'atlaslocalcare.example.test', locale = 'en-US', status = 'active' where id = $1",
      [existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    "insert into projects (tenant_id, client_id, name, target_domain, locale, status) values ($1, $2, $3, 'atlaslocalcare.example.test', 'en-US', 'active') returning id",
    [tenantId, clientId, DEMO.projectName],
  );
  return inserted.id;
}

async function ensureAudit(tenantId, clientId, projectId, userId) {
  const existing = await one(
    "select id from geo_aeo_audits where tenant_id = $1 and audit_name = $2 and deleted_at is null limit 1",
    [tenantId, DEMO.auditName],
  );
  const services = JSON.stringify(["primary care", "urgent visits", "telehealth"]);
  const facts = JSON.stringify({
    brandAliases: ["Atlas Local Care", "Atlas Care"],
    entityFocus: "Local healthcare provider with telehealth and urgent visit services.",
  });
  const summary =
    "Demo audit seeded from manual/mock answer snapshots for local AI visibility workflows.";

  if (existing) {
    await pool.query(
      `update geo_aeo_audits
       set client_id = $1, project_id = $2, website_url = $3, niche = 'Local healthcare',
           services_or_products = $4::jsonb, target_location = 'Austin, TX',
           target_audience = 'Patients looking for same-week local care',
           status = 'approved', monitoring_enabled = true, monitoring_cadence = 'monthly',
           business_facts = $5::jsonb, visibility_score = 72,
           visibility_label = 'Emerging AI Presence', summary = $6,
           updated_by_id = $7, approved_by_id = $7, approved_at = coalesce(approved_at, now())
       where id = $8`,
      [clientId, projectId, DEMO.websiteUrl, services, facts, summary, userId, existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    `insert into geo_aeo_audits
     (tenant_id, client_id, project_id, audit_name, website_url, niche, services_or_products,
      target_location, target_audience, status, monitoring_enabled, monitoring_cadence,
      business_facts, visibility_score, visibility_label, summary, created_by_id, updated_by_id,
      approved_by_id, approved_at)
     values ($1, $2, $3, $4, $5, 'Local healthcare', $6::jsonb, 'Austin, TX',
      'Patients looking for same-week local care', 'approved', true, 'monthly', $7::jsonb,
      72, 'Emerging AI Presence', $8, $9, $9, $9, now())
     returning id`,
    [
      tenantId,
      clientId,
      projectId,
      DEMO.auditName,
      DEMO.websiteUrl,
      services,
      facts,
      summary,
      userId,
    ],
  );
  return inserted.id;
}

async function ensureEngine(tenantId, auditId, engine, displayName) {
  const existing = await one(
    "select id from geo_aeo_engines where tenant_id = $1 and audit_id = $2 and engine = $3 limit 1",
    [tenantId, auditId, engine],
  );
  if (existing) {
    await pool.query(
      "update geo_aeo_engines set display_name = $1, mode = 'manual', status = 'active' where id = $2",
      [displayName, existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    "insert into geo_aeo_engines (tenant_id, audit_id, engine, display_name, mode, status) values ($1, $2, $3, $4, 'manual', 'active') returning id",
    [tenantId, auditId, engine, displayName],
  );
  return inserted.id;
}

async function ensurePromptSet(tenantId, auditId, userId) {
  const name = "Demo Prompt Matrix";
  const existing = await one(
    "select id from geo_aeo_prompt_sets where tenant_id = $1 and audit_id = $2 and name = $3 and deleted_at is null limit 1",
    [tenantId, auditId, name],
  );
  if (existing) {
    await pool.query(
      "update geo_aeo_prompt_sets set description = 'Repeatable manual/mock GEO/AEO demo prompts.', status = 'approved' where id = $1",
      [existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    "insert into geo_aeo_prompt_sets (tenant_id, audit_id, name, description, status, created_by_id) values ($1, $2, $3, 'Repeatable manual/mock GEO/AEO demo prompts.', 'approved', $4) returning id",
    [tenantId, auditId, name, userId],
  );
  return inserted.id;
}

async function ensurePrompt(tenantId, auditId, promptSetId, userId, prompt) {
  const normalized = prompt.promptText.toLowerCase().replace(/\s+/g, " ").trim();
  const existing = await one(
    "select id from geo_aeo_prompts where tenant_id = $1 and audit_id = $2 and normalized_prompt = $3 and deleted_at is null limit 1",
    [tenantId, auditId, normalized],
  );
  const params = [
    promptSetId,
    prompt.intent,
    prompt.funnelStage,
    prompt.serviceOrProduct,
    prompt.location,
    prompt.priority,
    userId,
  ];
  if (existing) {
    await pool.query(
      `update geo_aeo_prompts
       set prompt_set_id = $1, intent = $2, funnel_stage = $3, service_or_product = $4,
           location = $5, priority = $6, status = 'approved', updated_by_id = $7
       where id = $8`,
      [...params, existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    `insert into geo_aeo_prompts
     (tenant_id, audit_id, prompt_set_id, prompt_text, normalized_prompt, intent, funnel_stage,
      service_or_product, location, priority, status, created_by_id, updated_by_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'approved', $11, $11)
     returning id`,
    [
      tenantId,
      auditId,
      promptSetId,
      prompt.promptText,
      normalized,
      prompt.intent,
      prompt.funnelStage,
      prompt.serviceOrProduct,
      prompt.location,
      prompt.priority,
      userId,
    ],
  );
  return inserted.id;
}

async function ensureSnapshot(tenantId, auditId, promptId, userId, snapshot) {
  const answerHash = hashAnswer(snapshot.answerText);
  const existing = await one(
    "select id from geo_aeo_answer_snapshots where tenant_id = $1 and audit_id = $2 and prompt_id = $3 and engine = $4 and answer_hash = $5 and deleted_at is null limit 1",
    [tenantId, auditId, promptId, snapshot.engine, answerHash],
  );
  const params = [
    snapshot.captureMethod,
    snapshot.answerText,
    answerHash,
    snapshot.locationContext,
    snapshot.clientMentioned,
    snapshot.clientCited,
    snapshot.sentiment,
    snapshot.accuracyRiskScore,
    userId,
  ];
  if (existing) {
    await pool.query(
      `update geo_aeo_answer_snapshots
       set capture_method = $1, answer_text = $2, answer_hash = $3, location_context = $4,
           client_mentioned = $5, client_cited = $6, sentiment = $7, accuracy_risk_score = $8,
           approved_by_id = $9, approved_at = coalesce(approved_at, now())
       where id = $10`,
      [...params, existing.id],
    );
    return existing.id;
  }

  const inserted = await one(
    `insert into geo_aeo_answer_snapshots
     (tenant_id, audit_id, prompt_id, engine, engine_mode, capture_method, answer_text,
      answer_hash, location_context, client_mentioned, client_cited, sentiment,
      accuracy_risk_score, created_by_id, approved_by_id, approved_at)
     values ($1, $2, $3, $4, 'consumer_manual', $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, now())
     returning id`,
    [
      tenantId,
      auditId,
      promptId,
      snapshot.engine,
      snapshot.captureMethod,
      snapshot.answerText,
      answerHash,
      snapshot.locationContext,
      snapshot.clientMentioned,
      snapshot.clientCited,
      snapshot.sentiment,
      snapshot.accuracyRiskScore,
      userId,
    ],
  );
  return inserted.id;
}

async function ensureSimpleByName(
  table,
  selectSql,
  selectParams,
  insertSql,
  insertParams,
  updateSql,
  updateParams = insertParams,
) {
  const existing = await one(selectSql, selectParams);
  if (existing) {
    if (updateSql) await pool.query(updateSql, [...updateParams, existing.id]);
    return existing.id;
  }

  const inserted = await one(insertSql, insertParams);
  return inserted.id;
}

async function seed() {
  const tenantId = await ensureTenant();
  const userId = await ensureUser(tenantId);
  const clientId = await ensureClient(tenantId);
  const projectId = await ensureProject(tenantId, clientId);
  const auditId = await ensureAudit(tenantId, clientId, projectId, userId);

  await Promise.all([
    ensureEngine(tenantId, auditId, "chatgpt", "ChatGPT manual"),
    ensureEngine(tenantId, auditId, "gemini", "Gemini manual"),
    ensureEngine(tenantId, auditId, "perplexity", "Perplexity manual"),
    ensureEngine(tenantId, auditId, "google_ai_overviews", "Google AI Overviews manual"),
  ]);

  const promptSetId = await ensurePromptSet(tenantId, auditId, userId);
  const prompts = [
    {
      promptText: "Who are the best same-week primary care clinics in Austin?",
      intent: "recommendation",
      funnelStage: "consideration",
      serviceOrProduct: "primary care",
      location: "Austin, TX",
      priority: 95,
    },
    {
      promptText: "What urgent care options near downtown Austin offer telehealth follow-up?",
      intent: "local_research",
      funnelStage: "decision",
      serviceOrProduct: "urgent visits",
      location: "Austin, TX",
      priority: 90,
    },
    {
      promptText: "Compare Atlas Local Care with larger urgent care chains in Austin.",
      intent: "comparison",
      funnelStage: "decision",
      serviceOrProduct: "urgent visits",
      location: "Austin, TX",
      priority: 85,
    },
    {
      promptText: "Which Austin clinics are cited for transparent self-pay healthcare pricing?",
      intent: "citation_gap",
      funnelStage: "consideration",
      serviceOrProduct: "self-pay care",
      location: "Austin, TX",
      priority: 80,
    },
    {
      promptText: "Does Atlas Local Care provide pediatric sick visits?",
      intent: "faq",
      funnelStage: "decision",
      serviceOrProduct: "pediatric sick visits",
      location: "Austin, TX",
      priority: 75,
    },
    {
      promptText: "What healthcare providers in Austin have useful FAQ pages for AI answers?",
      intent: "schema",
      funnelStage: "awareness",
      serviceOrProduct: "FAQ content",
      location: "Austin, TX",
      priority: 70,
    },
    {
      promptText: "Find clinics near South Congress that treat minor injuries after work.",
      intent: "location_page",
      funnelStage: "decision",
      serviceOrProduct: "minor injury care",
      location: "South Congress, Austin",
      priority: 70,
    },
    {
      promptText: "What sources does Perplexity cite for walk-in healthcare options in Austin?",
      intent: "source_research",
      funnelStage: "awareness",
      serviceOrProduct: "walk-in care",
      location: "Austin, TX",
      priority: 65,
    },
  ];

  const promptIds = [];
  for (const prompt of prompts) {
    promptIds.push(await ensurePrompt(tenantId, auditId, promptSetId, userId, prompt));
  }

  const snapshotIds = [];
  const snapshots = [
    {
      promptIndex: 0,
      engine: "chatgpt",
      captureMethod: "mock_adapter",
      answerText:
        "Atlas Local Care is a useful local option for same-week primary care, especially for patients comparing clinic access and telehealth follow-up.",
      locationContext: "Austin, TX",
      clientMentioned: true,
      clientCited: false,
      sentiment: "positive",
      accuracyRiskScore: 12,
    },
    {
      promptIndex: 1,
      engine: "perplexity",
      captureMethod: "manual_paste",
      answerText:
        "Perplexity lists larger urgent care chains first and cites local directories, but Atlas Local Care is missing from the cited answer.",
      locationContext: "Austin, TX",
      clientMentioned: false,
      clientCited: false,
      sentiment: "neutral",
      accuracyRiskScore: 24,
    },
    {
      promptIndex: 2,
      engine: "gemini",
      captureMethod: "mock_adapter",
      answerText:
        "Atlas Local Care is mentioned alongside Austin Quick Clinic, but the answer gives stronger proof points to the competitor.",
      locationContext: "Austin, TX",
      clientMentioned: true,
      clientCited: false,
      sentiment: "mixed",
      accuracyRiskScore: 18,
    },
    {
      promptIndex: 3,
      engine: "google_ai_overviews",
      captureMethod: "manual_paste",
      answerText:
        "Google AI Overviews emphasizes insurance directories and hospital-owned clinics for pricing information; Atlas Local Care is not cited.",
      locationContext: "Austin, TX",
      clientMentioned: false,
      clientCited: false,
      sentiment: "neutral",
      accuracyRiskScore: 28,
    },
  ];

  for (const snapshot of snapshots) {
    snapshotIds.push(
      await ensureSnapshot(tenantId, auditId, promptIds[snapshot.promptIndex], userId, snapshot),
    );
  }

  await ensureSimpleByName(
    "geo_aeo_competitors",
    "select id from geo_aeo_competitors where tenant_id = $1 and audit_id = $2 and name = $3 and deleted_at is null limit 1",
    [tenantId, auditId, "Austin Quick Clinic"],
    "insert into geo_aeo_competitors (tenant_id, audit_id, name, website_url, aliases, notes, created_by_id) values ($1, $2, $3, $4, $5::jsonb, $6, $7) returning id",
    [
      tenantId,
      auditId,
      "Austin Quick Clinic",
      "https://austinquickclinic.example.test",
      JSON.stringify(["AQC", "Quick Clinic Austin"]),
      "Frequently appears before the client in urgent-care answers.",
      userId,
    ],
    "update geo_aeo_competitors set website_url = $1, aliases = $2::jsonb, notes = $3, created_by_id = $4 where id = $5",
    [
      "https://austinquickclinic.example.test",
      JSON.stringify(["AQC", "Quick Clinic Austin"]),
      "Frequently appears before the client in urgent-care answers.",
      userId,
    ],
  );

  await ensureSimpleByName(
    "geo_aeo_citations",
    "select id from geo_aeo_citations where tenant_id = $1 and audit_id = $2 and source_name = $3 and deleted_at is null limit 1",
    [tenantId, auditId, "Atlas care access page"],
    "insert into geo_aeo_citations (tenant_id, audit_id, snapshot_id, url, source_name, source_type, is_client_owned, authority_estimate, notes, created_by_id) values ($1, $2, $3, $4, $5, $6, true, $7, $8, $9) returning id",
    [
      tenantId,
      auditId,
      snapshotIds[0],
      "https://atlaslocalcare.example.test/access",
      "Atlas care access page",
      "client_site",
      62,
      "Client-owned source to strengthen answer-engine citation eligibility.",
      userId,
    ],
    "update geo_aeo_citations set snapshot_id = $1, url = $2, source_type = $3, is_client_owned = true, authority_estimate = $4, notes = $5, created_by_id = $6 where id = $7",
    [
      snapshotIds[0],
      "https://atlaslocalcare.example.test/access",
      "client_site",
      62,
      "Client-owned source to strengthen answer-engine citation eligibility.",
      userId,
    ],
  );

  const sourceRecId = await ensureSimpleByName(
    "geo_aeo_source_recommendations",
    "select id from geo_aeo_source_recommendations where tenant_id = $1 and audit_id = $2 and source_name = $3 and deleted_at is null limit 1",
    [tenantId, auditId, "Austin transparent care guide"],
    "insert into geo_aeo_source_recommendations (tenant_id, audit_id, source_name, source_url, source_type, reason, priority, status, created_by_id, updated_by_id) values ($1, $2, $3, $4, $5, $6, 'high', 'approved', $7, $7) returning id",
    [
      tenantId,
      auditId,
      "Austin transparent care guide",
      "https://atlaslocalcare.example.test/guides/austin-transparent-care",
      "client_content",
      "Create a structured, citable page for pricing and same-week care answers.",
      userId,
    ],
    "update geo_aeo_source_recommendations set source_url = $1, source_type = $2, reason = $3, priority = 'high', status = 'approved', updated_by_id = $4 where id = $5",
    [
      "https://atlaslocalcare.example.test/guides/austin-transparent-care",
      "client_content",
      "Create a structured, citable page for pricing and same-week care answers.",
      userId,
    ],
  );

  await ensureSimpleByName(
    "geo_aeo_schema_findings",
    "select id from geo_aeo_schema_findings where tenant_id = $1 and audit_id = $2 and page_url = $3 and issue_type = $4 and deleted_at is null limit 1",
    [tenantId, auditId, "https://atlaslocalcare.example.test/faq", "missing_faq_schema"],
    "insert into geo_aeo_schema_findings (tenant_id, audit_id, page_url, schema_type, issue_type, severity, recommendation, status, created_by_id, updated_by_id) values ($1, $2, $3, 'FAQPage', $4, 'medium', $5, 'approved', $6, $6) returning id",
    [
      tenantId,
      auditId,
      "https://atlaslocalcare.example.test/faq",
      "missing_faq_schema",
      "Add FAQPage schema for pediatric sick visits, telehealth follow-up, and self-pay pricing.",
      userId,
    ],
    "update geo_aeo_schema_findings set schema_type = 'FAQPage', severity = 'medium', recommendation = $1, status = 'approved', updated_by_id = $2 where id = $3",
    [
      "Add FAQPage schema for pediatric sick visits, telehealth follow-up, and self-pay pricing.",
      userId,
    ],
  );

  await pool.query(
    "delete from geo_aeo_visibility_scores where tenant_id = $1 and audit_id = $2 and is_manual_override = false",
    [tenantId, auditId],
  );
  await pool.query(
    "insert into geo_aeo_visibility_scores (tenant_id, audit_id, score, label, inputs, explanations, is_manual_override, created_by_id) values ($1, $2, 72, 'Emerging AI Presence', $3::jsonb, $4::jsonb, false, $5)",
    [
      tenantId,
      auditId,
      JSON.stringify({
        brandMentionCoverage: 50,
        citationCoverage: 25,
        promptIntentCoverage: 50,
        competitorGapOpportunity: 45,
        entityClarityScore: 70,
        schemaReadinessScore: 60,
        sourceAuthorityReadiness: 65,
        accuracyRiskScore: 20,
      }),
      JSON.stringify([
        "Client appears in half of seeded answer snapshots.",
        "Citation readiness is the largest demo gap.",
        "Schema and source recommendations are approved for follow-up.",
      ]),
      userId,
    ],
  );

  const findingId = await ensureSimpleByName(
    "geo_aeo_findings",
    "select id from geo_aeo_findings where tenant_id = $1 and audit_id = $2 and title = $3 and deleted_at is null limit 1",
    [tenantId, auditId, "Competitors receive stronger AI proof points"],
    "insert into geo_aeo_findings (tenant_id, audit_id, finding_type, severity, title, description, evidence, recommendation, status, created_by_id, updated_by_id, approved_by_id, approved_at) values ($1, $2, 'competitor_dominates', 'high', $3, $4, $5::jsonb, $6, 'approved', $7, $7, $7, now()) returning id",
    [
      tenantId,
      auditId,
      "Competitors receive stronger AI proof points",
      "Manual/mock snapshots show competitors receiving clearer proof points and citations in local urgent-care answers.",
      JSON.stringify({ snapshotIds, sourceRecommendationId: sourceRecId }),
      "Publish citable service and pricing pages, then refresh answer snapshots monthly.",
      userId,
    ],
    "update geo_aeo_findings set description = $1, evidence = $2::jsonb, recommendation = $3, status = 'approved', updated_by_id = $4, approved_by_id = $4, approved_at = coalesce(approved_at, now()) where id = $5",
    [
      "Manual/mock snapshots show competitors receiving clearer proof points and citations in local urgent-care answers.",
      JSON.stringify({ snapshotIds, sourceRecommendationId: sourceRecId }),
      "Publish citable service and pricing pages, then refresh answer snapshots monthly.",
      userId,
    ],
  );

  const planId = await ensureSimpleByName(
    "geo_aeo_action_plans",
    "select id from geo_aeo_action_plans where tenant_id = $1 and audit_id = $2 and name = $3 and deleted_at is null limit 1",
    [tenantId, auditId, "30-day AI visibility action plan"],
    "insert into geo_aeo_action_plans (tenant_id, audit_id, name, time_horizon_days, summary, status, created_by_id, updated_by_id, approved_by_id, approved_at) values ($1, $2, $3, 30, $4, 'approved', $5, $5, $5, now()) returning id",
    [
      tenantId,
      auditId,
      "30-day AI visibility action plan",
      "Four-week demo plan focused on entity clarity, citable pages, FAQ schema, and monitoring.",
      userId,
    ],
    "update geo_aeo_action_plans set time_horizon_days = 30, summary = $1, status = 'approved', updated_by_id = $2, approved_by_id = $2, approved_at = coalesce(approved_at, now()) where id = $3",
    [
      "Four-week demo plan focused on entity clarity, citable pages, FAQ schema, and monitoring.",
      userId,
    ],
  );

  const actions = [
    ["Publish pricing and care access source page", "source_citation", 1, findingId],
    ["Add FAQPage schema for pediatric and telehealth questions", "faq_schema", 2, null],
    ["Build South Congress minor injury landing page", "location_page", 3, null],
    ["Refresh manual snapshots and compare month-over-month", "measurement", 4, findingId],
  ];

  for (const [title, category, weekNumber, relatedFindingId] of actions) {
    await ensureSimpleByName(
      "geo_aeo_action_items",
      "select id from geo_aeo_action_items where tenant_id = $1 and audit_id = $2 and action_plan_id = $3 and title = $4 and deleted_at is null limit 1",
      [tenantId, auditId, planId, title],
      "insert into geo_aeo_action_items (tenant_id, audit_id, action_plan_id, title, description, category, priority, week_number, owner_role, status, related_finding_id, created_by_id, updated_by_id) values ($1, $2, $3, $4, $5, $6, 'high', $7, 'operator', 'approved', $8, $9, $9) returning id",
      [
        tenantId,
        auditId,
        planId,
        title,
        `${title} for the seeded GEO/AEO demo audit.`,
        category,
        weekNumber,
        relatedFindingId,
        userId,
      ],
      "update geo_aeo_action_items set description = $1, category = $2, priority = 'high', week_number = $3, owner_role = 'operator', status = 'approved', related_finding_id = $4, updated_by_id = $5 where id = $6",
      [
        `${title} for the seeded GEO/AEO demo audit.`,
        category,
        weekNumber,
        relatedFindingId,
        userId,
      ],
    );
  }

  await ensureSimpleByName(
    "geo_aeo_monitoring_runs",
    "select id from geo_aeo_monitoring_runs where tenant_id = $1 and audit_id = $2 and run_month = '2026-06' limit 1",
    [tenantId, auditId],
    "insert into geo_aeo_monitoring_runs (tenant_id, audit_id, run_month, baseline_month, comparison_month, status, baseline_score, current_score, score_delta, baseline_snapshot_count, current_snapshot_count, summary, notes, created_by_id, updated_by_id, approved_by_id, approved_at) values ($1, $2, '2026-06', '2026-05', '2026-06', 'approved', 64, 72, 8, 3, 4, $3, $4, $5, $5, $5, now()) returning id",
    [
      tenantId,
      auditId,
      "Demo monitoring run shows improvement after source and schema recommendations.",
      "Seeded for local/manual GEO/AEO monthly monitoring demos.",
      userId,
    ],
    "update geo_aeo_monitoring_runs set baseline_month = '2026-05', comparison_month = '2026-06', status = 'approved', baseline_score = 64, current_score = 72, score_delta = 8, baseline_snapshot_count = 3, current_snapshot_count = 4, summary = $1, notes = $2, updated_by_id = $3, approved_by_id = $3, approved_at = coalesce(approved_at, now()) where id = $4",
    [
      "Demo monitoring run shows improvement after source and schema recommendations.",
      "Seeded for local/manual GEO/AEO monthly monitoring demos.",
      userId,
    ],
  );

  await ensureSimpleByName(
    "reports",
    "select id from reports where tenant_id = $1 and project_id = $2 and type = 'geo_aeo_visibility_audit' and format = 'markdown' limit 1",
    [tenantId, projectId],
    "insert into reports (tenant_id, project_id, type, format, generated_at, data) values ($1, $2, 'geo_aeo_visibility_audit', 'markdown', now(), $3::jsonb) returning id",
    [
      tenantId,
      projectId,
      JSON.stringify({
        audit: {
          id: auditId,
          auditName: DEMO.auditName,
          websiteUrl: DEMO.websiteUrl,
          visibilityScore: 72,
          visibilityLabel: "Emerging AI Presence",
        },
        summary: {
          promptCount: prompts.length,
          snapshotCount: snapshots.length,
          findingCount: 1,
          actionItemCount: actions.length,
        },
        methodology: {
          dataSources: ["Manual prompt inventory", "Mock/manual answer snapshots"],
          limitations: ["Demo seed data is deterministic and not a live provider result."],
        },
      }),
    ],
    "update reports set generated_at = now(), data = $1::jsonb where id = $2",
    [
      JSON.stringify({
        audit: {
          id: auditId,
          auditName: DEMO.auditName,
          websiteUrl: DEMO.websiteUrl,
          visibilityScore: 72,
          visibilityLabel: "Emerging AI Presence",
        },
        summary: {
          promptCount: prompts.length,
          snapshotCount: snapshots.length,
          findingCount: 1,
          actionItemCount: actions.length,
        },
        methodology: {
          dataSources: ["Manual prompt inventory", "Mock/manual answer snapshots"],
          limitations: ["Demo seed data is deterministic and not a live provider result."],
        },
      }),
    ],
  );

  console.log(
    `Seeded GEO/AEO demo audit ${auditId} for tenant ${tenantId}. Demo login: ${DEMO.userEmail} / ${DEMO.userPassword}`,
  );
}

try {
  await seed();
} finally {
  await pool.end();
}
