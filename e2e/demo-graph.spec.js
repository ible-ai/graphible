import { test, expect } from '@playwright/test';

// The demo backend needs no Ollama, no API key and no WebGPU, so the whole
// graph surface is exercisable in CI.
async function loadDemoGraph(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started', exact: true }).click();
  await page.getByRole('button', { name: /Try the demo/i }).click();
  await expect(page.locator('.node-component').first()).toBeVisible();
}

test.describe('demo graph', () => {
  test('boots and renders the demo graph without page errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await loadDemoGraph(page);

    await expect(page.locator('.node-component')).toHaveCount(4);
    await expect(page.locator('.node-component h3').first()).toHaveText('Neural Networks Overview');
    await expect(page.locator('#loading')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('draws the demo graph edges, not just its nodes', async ({ page }) => {
    await loadDemoGraph(page);

    // Regression: handleLoadDemoGraph added every node but never called
    // setConnections, so the demo rendered as four unconnected boxes.
    // DEMO_GRAPH_DATA declares four edges.
    await expect(page.locator('svg path[marker-end]')).toHaveCount(4);
  });

  test('deletes the root node, whose id is 0', async ({ page }) => {
    await loadDemoGraph(page);

    // Regression: the lookup was `n && n.id && n.id === nodeId`, and 0 is
    // falsy, so the root node could never be found and delete silently no-oped.
    const root = page.locator('.node-component').filter({ hasText: 'Neural Networks Overview' });
    await root.hover();
    await root.locator('button[title="Delete node"]').click();

    await expect(page.locator('.node-component')).toHaveCount(3);
  });

  test('keeps the surviving edges correct after a delete', async ({ page }) => {
    await loadDemoGraph(page);

    // Demo edges are 0->1, 0->2, 1->3, 2->3. Removing node 1 should drop the
    // two edges touching it and leave 0->2 and 2->3.
    const node = page.locator('.node-component').filter({ hasText: 'Basic Architecture' });
    await node.hover();
    await node.locator('button[title="Delete node"]').click();

    await expect(page.locator('.node-component')).toHaveCount(3);
    // Regression: edges were resolved as nodes[conn.from], an array index.
    // Deletion filters without reindexing, so ids and positions diverge and
    // surviving edges were dropped or drawn between the wrong pair.
    await expect(page.locator('svg path[marker-end]')).toHaveCount(2);
  });

  test('shows the graph chrome: minimap, details panel and header actions', async ({ page }) => {
    await loadDemoGraph(page);

    await expect(page.locator('.minimap-container')).toHaveCount(1);
    await expect(page.locator('.details-panel')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Optimize Layout/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Deleted \(0\)/ })).toBeVisible();
  });

  test('clicking a node focuses it and shows its content', async ({ page }) => {
    await loadDemoGraph(page);

    await page.locator('.node-component').filter({ hasText: 'Activation Functions' }).click();
    await expect(page.locator('.details-panel')).toContainText('Activation Functions');
    // Only the details panel renders a node's full markdown body.
    await expect(page.locator('.details-panel')).toContainText('ReLU');
  });

  test('renders a context-mode label', async ({ page }) => {
    await loadDemoGraph(page);

    // Regression: App compared contextMode against 'smart', which the hook
    // never produces, so this button rendered with no label at all in the
    // default mode.
    await expect(page.getByRole('button', { name: /^(Auto|Manual|Branch|Batch)/ })).toBeVisible();
  });

  test('offers feedback controls on a node', async ({ page }) => {
    await loadDemoGraph(page);

    const node = page.locator('.node-component').first();
    await node.hover();

    // Regression: NodeComponent accepted onFeedback but never called it, so
    // the whole feedback path was unreachable from the running app.
    await expect(node.locator('.node-controls button[title="This was helpful"]')).toBeVisible();
    await expect(node.locator('.node-controls button[title="This needs improvement"]')).toBeVisible();

    await node.locator('button[title="This was helpful"]').click();
    await expect(page.getByText('What worked well?')).toBeVisible();
  });

  test('deletes a node into the deletion store and restores it', async ({ page }) => {
    await loadDemoGraph(page);

    const node = page.locator('.node-component').filter({ hasText: 'Training Process' });
    await node.hover();
    await node.locator('button[title="Delete node"]').click();

    await expect(page.locator('.node-component')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Deleted \(1\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Deleted \(1\)/ }).click();
    await page.getByRole('button', { name: /^Restore$/ }).click();
    await expect(page.locator('.node-component')).toHaveCount(4);
  });
});

test.describe('camera', () => {
  test('pans the canvas by the distance dragged, exactly once', async ({ page }) => {
    await loadDemoGraph(page);

    const node = page.locator('.node-component').first();
    const before = await node.boundingBox();

    const DX = 120;
    const DY = 60;
    // Drag from an empty patch of canvas, away from nodes and the minimap.
    await page.mouse.move(650, 200);
    await page.mouse.down();
    await page.mouse.move(650 + DX, 200 + DY, { steps: 12 });
    await page.mouse.up();

    const after = await node.boundingBox();

    // Regression: two near-identical effects each registered document-level
    // mousedown/mousemove/mouseup, so every drag was applied twice and the
    // canvas travelled roughly double the pointer distance.
    expect(after.x - before.x).toBeGreaterThan(DX * 0.75);
    expect(after.x - before.x).toBeLessThan(DX * 1.4);
    expect(after.y - before.y).toBeGreaterThan(DY * 0.75);
    expect(after.y - before.y).toBeLessThan(DY * 1.4);
  });

  test('does not pan the canvas while dragging a node', async ({ page }) => {
    await loadDemoGraph(page);

    const nodes = page.locator('.node-component');
    const target = nodes.filter({ hasText: 'Basic Architecture' });
    const other = nodes.filter({ hasText: 'Neural Networks Overview' });

    const otherBefore = await other.boundingBox();
    const box = await target.boundingBox();

    // Shift+drag moves a node. Regression: App read isDraggingNode, which the
    // hook never returns, so the guard was dead and the camera panned too -
    // every other node would have moved with it.
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    const otherAfter = await other.boundingBox();
    expect(Math.abs(otherAfter.x - otherBefore.x)).toBeLessThan(12);
    expect(Math.abs(otherAfter.y - otherBefore.y)).toBeLessThan(12);
  });
});

test.describe('setup wizard', () => {
  test('quotes the browser model that is actually configured', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();

    // Regression: this advertised "Llama 3.2 3B ... 2GB" while
    // DEFAULT_MODEL_CONFIGS.WEBLLM pointed at Qwen3-0.6B-ONNX.
    await expect(page.getByRole('button', { name: /AI in your browser/ })).toContainText('0.6 GB');
  });

  test('offers the Gemini models the config declares', async ({ page }) => {
    await loadDemoGraph(page);

    // The model dropdown renders LLM_CONFIG.EXTERNAL.GOOGLE.MODELS, so this
    // catches the catalog drifting from the ids the code actually sends.
    await page.locator('button').filter({ hasText: /No model detected|Demo/ }).first().click();
    await page.getByRole('button', { name: /External API/ }).click();

    for (const id of ['Gemini 3.5 Flash Lite', 'Gemini 3.6 Flash', 'Gemini 3.7 Flash']) {
      await expect(page.getByText(id, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/Gemini 2\.5/)).toHaveCount(0);
  });
});
