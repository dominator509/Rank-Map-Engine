import { expect, type Page, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoAccessibilityViolations(page: Page, selector = "body") {
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .include(selector)
    .analyze();

  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

async function expectStablePageScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
}

test("new workspace can register, sign in, and create a client project", async ({ page }) => {
  const unique = Date.now();
  const email = `browser-e2e-${unique}@rankmap.test`;
  const password = "BrowserE2E!234";
  const fullName = "Browser E2E Owner";
  const workspaceName = `E2E Workspace ${unique}`;
  const clientName = `E2E Client ${unique}`;
  const clientDomain = `e2e-${unique}.example.com`;
  const projectName = `E2E Project ${unique}`;
  const keywordPhrase = `rankmap browser keyword ${unique}`;
  const importedKeywordOne = `rankmap imported keyword one ${unique}`;
  const importedKeywordTwo = `rankmap imported keyword two ${unique}`;
  const briefTitle = `Browser E2E Content Brief ${unique}`;
  const updatedWorkspaceName = `E2E Updated Workspace ${unique}`;
  const whiteLabelName = `E2E Portal ${unique}`;
  const inviteEmail = `invite-${unique}@rankmap.test`;

  await page.goto("/register", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await expectStablePageScreenshot(page, "register-page.png");
  await page.getByLabel("Full Name").fill(fullName);
  await page.getByLabel("Agency / Workspace Name").fill(workspaceName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Total Clients")).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");
  await expectStablePageScreenshot(page, "dashboard-empty-desktop.png");

  await page.getByTestId("link-clients").click();
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");
  await expectStablePageScreenshot(page, "clients-empty-desktop.png");
  await page.getByRole("button", { name: "Add Client" }).click();
  await page.getByLabel("Client Name").fill(clientName);
  await page.getByLabel("Primary Domain").fill(clientDomain);
  await page.getByLabel("Industry").fill("Software");
  await page.getByRole("button", { name: "Save Client" }).click();

  await expect(page.getByRole("link", { name: clientName })).toBeVisible();
  await page.getByRole("link", { name: clientName }).click();

  await expect(page.getByRole("heading", { name: clientName })).toBeVisible();
  await expect(page.getByText(clientDomain)).toBeVisible();
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project Name").fill(projectName);
  await expect(page.getByLabel("Target Domain")).toHaveValue(clientDomain);
  await page.getByRole("button", { name: "Save Project" }).click();

  await expect(page.getByRole("link", { name: projectName })).toBeVisible();
  await page.getByRole("link", { name: projectName }).click();

  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Keywords" })).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");

  await page.getByRole("button", { name: "Add Keyword" }).click();
  await page.getByPlaceholder("best seo tools").fill(keywordPhrase);
  await page.getByPlaceholder("1000").fill("1200");
  await page.getByPlaceholder("45").fill("38");
  await page.getByPlaceholder("2.50").fill("3.25");
  await page.getByRole("button", { name: "Add Keyword" }).click();

  await expect(page.getByText(keywordPhrase)).toBeVisible();
  await expect(page.getByText("1,200")).toBeVisible();
  await expect(page.getByText("$3.25")).toBeVisible();

  await page.getByRole("button", { name: "Import" }).click();
  await page
    .getByPlaceholder(/best seo tools/)
    .fill(`${importedKeywordOne}\n${importedKeywordTwo}`);
  await expect(page.getByText("2 keywords detected")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Import" }).click();

  await expect(page.getByText(importedKeywordOne)).toBeVisible();
  await expect(page.getByText(importedKeywordTwo)).toBeVisible();

  await page.getByRole("tab", { name: "Briefs" }).click();
  await expect(page.getByRole("heading", { name: "Content Briefs" })).toBeVisible();
  await page.getByRole("button", { name: "New Brief" }).click();
  await page.getByPlaceholder("The Ultimate Guide to SEO Tools").fill(briefTitle);
  await page.getByPlaceholder("2000").fill("1800");
  await page.getByRole("button", { name: "Create Brief" }).click();

  await expect(page.getByText(briefTitle)).toBeVisible();
  await expect(page.getByText("1,800 words target")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("Brief approved", { exact: true }).first()).toBeVisible();

  await page.getByTestId("link-settings").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");
  await page.getByLabel("Workspace Name").fill(updatedWorkspaceName);
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Workspace name updated", { exact: true }).first()).toBeVisible();

  await page.getByLabel("App Name").fill(whiteLabelName);
  await page.getByLabel("Logo URL").fill("https://example.com/logo.png");
  await page.getByLabel("Primary Color").fill("#2563eb");
  await page.getByRole("button", { name: "Save White-Label Config" }).click();
  await expect(page.getByText("White-label config saved", { exact: true }).first()).toBeVisible();

  await page.getByTestId("link-billing").click();
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");
  await expect(page.getByText("Current Plan").first()).toBeVisible();
  await expect(page.getByText("Solo", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Current Plan" })).toBeDisabled();
  await expectStablePageScreenshot(page, "billing-solo-desktop.png");
  await page.getByRole("button", { name: "Upgrade to Agency" }).click();
  await expect(
    page.getByText("Stripe is not configured in this environment", { exact: true }).first(),
  ).toBeVisible();

  await page.getByTestId("link-team").click();
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Invite Member" }).click();
  await page.getByPlaceholder("colleague@example.com").fill(inviteEmail);
  await page.getByRole("button", { name: "Send Invitation" }).click();
  await expect(page.getByText(/Seat limit reached/).first()).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "RankMap" })).toBeVisible();
  await expect(page.getByTestId("mobile-link-dashboard")).toBeVisible();
  await expect(page.locator("header")).toHaveScreenshot("mobile-primary-navigation.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.02,
  });
  await page.getByTestId("mobile-link-clients").click();
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await page.getByTestId("mobile-link-settings").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator("#main-content")).toBeInViewport();
});

test("operator can complete a GEO/AEO manual browser workflow", async ({ page }) => {
  const unique = Date.now();
  const email = `browser-geo-aeo-${unique}@rankmap.test`;
  const password = "BrowserE2E!234";
  const fullName = "Browser GEO/AEO Owner";
  const workspaceName = `GEO AEO Workspace ${unique}`;
  const clientName = `GEO AEO Client ${unique}`;
  const clientDomain = `geo-aeo-${unique}.example.com`;
  const projectName = `GEO AEO Project ${unique}`;
  const geoAuditName = `Browser GEO AEO Audit ${unique}`;
  const geoCompetitorName = `Browser Competitor ${unique}`;
  const geoSourceName = `Browser Source ${unique}`;

  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Full Name").fill(fullName);
  await page.getByLabel("Agency / Workspace Name").fill(workspaceName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByTestId("link-clients").click();
  await page.getByRole("button", { name: "Add Client" }).click();
  await page.getByLabel("Client Name").fill(clientName);
  await page.getByLabel("Primary Domain").fill(clientDomain);
  await page.getByLabel("Industry").fill("Software");
  await page.getByRole("button", { name: "Save Client" }).click();
  await page.getByRole("link", { name: clientName }).click();
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByRole("link", { name: projectName })).toBeVisible();

  await page.getByTestId("link-geo/aeo-visibility").click();
  await expect(page.getByRole("heading", { name: "GEO/AEO Visibility" })).toBeVisible();
  await expectNoAccessibilityViolations(page, "#main-content");
  await page.getByRole("button", { name: "New Audit" }).click();

  const geoDialog = page.getByRole("dialog");
  await expect(geoDialog.getByRole("heading", { name: "New GEO/AEO Audit" })).toBeVisible();
  await geoDialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: clientName }).click();
  await geoDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: projectName }).click();
  await geoDialog.getByLabel("Audit Name").fill(geoAuditName);
  await geoDialog.getByLabel("Website URL").fill(`https://${clientDomain}`);
  await geoDialog.getByLabel("Niche").fill("AI visibility software");
  await geoDialog.getByLabel("Target Location").fill("United States");
  await geoDialog.getByLabel("Services or Products").fill("AI visibility, rank tracking");
  await geoDialog.getByLabel("Target Audience").fill("Marketing teams");
  await geoDialog.getByRole("button", { name: "Create Audit" }).click();

  await expect(page.getByText("GEO/AEO audit created", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: geoAuditName })).toBeVisible();
  await expect(page.getByText(`https://${clientDomain}`).first()).toBeVisible();

  await page
    .getByTestId("geo-aeo-prompt-csv")
    .fill(
      "promptText,intent,funnelStage,serviceOrProduct,location,priority\n" +
        `"What is the best AI visibility platform for SaaS teams?","commercial","decision","AI visibility","US","90"`,
    );
  await page.getByTestId("geo-aeo-preview-prompts").click();
  await expect(page.getByTestId("geo-aeo-import-preview-summary").getByText("1 valid")).toBeVisible();
  await page.getByTestId("geo-aeo-import-prompts").click();
  await expect(page.getByText("Prompts imported", { exact: true }).first()).toBeVisible();

  await page
    .getByTestId("geo-aeo-snapshot-csv")
    .fill(
      "promptId,engine,captureMethod,answerText,locationContext\n" +
        `1,chatgpt,manual_paste,"${clientName} is a strong AI visibility choice. See https://${clientDomain}/ai-visibility for proof.",US`,
    );
  await page.getByTestId("geo-aeo-preview-snapshots").click();
  await expect(page.getByTestId("geo-aeo-import-preview-summary").getByText("1 valid")).toBeVisible();
  await page.getByTestId("geo-aeo-import-snapshots").click();
  await expect(page.getByText("Snapshots imported", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1 answer snapshots")).toBeVisible();

  await page.getByRole("button", { name: "Mention" }).click();
  await expect(page.getByText("Snapshot markings updated", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cited" }).click();
  await expect(page.getByText("Snapshot markings updated", { exact: true }).first()).toBeVisible();

  await page.getByPlaceholder("Competitor name").fill(geoCompetitorName);
  await page.getByPlaceholder("https://competitor.com").fill(`https://competitor-${unique}.example.com`);
  await page.getByTestId("geo-aeo-add-competitor").click();
  await expect(page.getByText("Competitor added", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Competitor name").fill(`${geoCompetitorName} Updated`);
  await page.getByTestId("geo-aeo-save-competitor").click();
  await expect(page.getByText("Competitor updated", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Competitor name")).toHaveValue(`${geoCompetitorName} Updated`);
  await page.getByRole("button", { name: "Remove competitor" }).click();
  await expect(page.getByText("Competitor removed", { exact: true }).first()).toBeVisible();

  await page.getByPlaceholder("Source name").first().fill(geoSourceName);
  await page.getByPlaceholder("https://source.com/page").fill(`https://${clientDomain}/ai-visibility`);
  await page.getByTestId("geo-aeo-add-citation").click();
  await expect(page.getByText("Citation added", { exact: true }).first()).toBeVisible();

  await page.getByPlaceholder("Source name").nth(1).fill("Browser Directory");
  await page.getByPlaceholder("https://directory.com/profile").fill(`https://directory-${unique}.example.com/profile`);
  await page.getByTestId("geo-aeo-add-source-recommendation").click();
  await expect(page.getByText("Source recommendation added", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Source target name").fill("Browser Directory Updated");
  await page.getByTestId("geo-aeo-save-source-recommendation").click();
  await expect(page.getByText("Source recommendation updated", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Remove source recommendation" }).click();
  await expect(page.getByText("Source recommendation removed", { exact: true }).first()).toBeVisible();

  await page.getByPlaceholder("Missing FAQPage").fill("Missing FAQPage schema");
  await page.getByPlaceholder("https://site.com/page").fill(`https://${clientDomain}/ai-visibility`);
  await page.getByTestId("geo-aeo-add-schema-finding").click();
  await expect(page.getByText("Schema finding added", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Schema issue").fill("Missing FAQPage schema on service page");
  await page.getByTestId("geo-aeo-save-schema-finding").click();
  await expect(page.getByText("Schema finding updated", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Remove schema finding" }).click();
  await expect(page.getByText("Schema finding removed", { exact: true }).first()).toBeVisible();

  await page.getByTestId("geo-aeo-analyze").click();
  await expect(page.getByText("Analysis complete", { exact: true }).first()).toBeVisible();
  await page.getByTestId("geo-aeo-override-score").fill("82");
  await page.getByTestId("geo-aeo-override-reason").fill("Operator reviewed the snapshot set and corrected score.");
  await page.getByTestId("geo-aeo-save-score-override").click();
  await expect(page.getByText("Score override saved", { exact: true }).first()).toBeVisible();
  await page.getByTestId("geo-aeo-action-plan").click();
  await expect(page.getByText("Action plan generated", { exact: true }).first()).toBeVisible();
  await page.getByTestId("geo-aeo-action-item-title").fill("Manual browser action item");
  await page.getByPlaceholder("Optional implementation notes").fill("Add a manual task from operator review.");
  await page.getByTestId("geo-aeo-add-action-item").click();
  await expect(page.getByText("Action item added", { exact: true }).first()).toBeVisible();
  await page.getByTestId("geo-aeo-existing-action-title").last().fill("Manual browser action item updated");
  await page.getByTestId("geo-aeo-save-action-item").last().click();
  await expect(page.getByText("Action item updated", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Remove action item" }).last().click();
  await expect(page.getByText("Action item removed", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Baseline Month").fill("2026-05");
  await page.getByLabel("Baseline Score").fill("70");
  await page.getByLabel("Current Score").fill("78");
  await page.getByTestId("geo-aeo-add-monitoring-run").click();
  await expect(page.getByText("Monitoring run created", { exact: true }).first()).toBeVisible();
  await page.getByTestId("geo-aeo-approve-monitoring-run").click();
  await expect(page.getByText("Monitoring run approved", { exact: true }).first()).toBeVisible();

  await page.getByTestId("geo-aeo-report-pdf").click();
  await expect(page.getByText("Report generated", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("geo aeo visibility audit").first()).toBeVisible();
  await page.getByTestId("geo-aeo-approve-audit").click();
  await expect(page.getByText("Audit approved", { exact: true }).first()).toBeVisible();
});
