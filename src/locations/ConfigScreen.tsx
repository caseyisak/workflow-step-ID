import { useEffect, useState } from 'react';
import { ConfigAppSDK } from '@contentful/app-sdk';
import { 
  Heading, 
  Flex, 
  Button,
  FormControl,
  Select,
  Tabs,
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  Spinner,
  Note,
  Text,
  Box,
  Badge
} from '@contentful/f36-components';
import { useSDK } from '@contentful/react-apps-toolkit';

interface WorkflowStep {
  id: string;
  name: string;
}

interface WorkflowDefinition {
  sys: {
    id: string;
  };
  name: string;
  steps: WorkflowStep[];
}

const ConfigScreen = () => {
  const sdk = useSDK<ConfigAppSDK>();
  const [currentTab, setCurrentTab] = useState<'definitions' | 'entries'>('definitions');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workflowInstances, setWorkflowInstances] = useState<any[]>([]);
  const [workflowInstancesLoading, setWorkflowInstancesLoading] = useState(false);
  const [workflowInstancesError, setWorkflowInstancesError] = useState<string | null>(null);
  const [workflowInstancesTotal, setWorkflowInstancesTotal] = useState<number | null>(null);
  const [workflowInstancesSkip, setWorkflowInstancesSkip] = useState(0);
  const workflowInstancesLimit = 25;

  const [selectedWorkflowDefinitionId, setSelectedWorkflowDefinitionId] = useState<string>('all');
  const [selectedStepId, setSelectedStepId] = useState<string>('all');

  const [contentTypeDisplayFieldById, setContentTypeDisplayFieldById] = useState<Record<string, string>>({});
  const [entryTitleById, setEntryTitleById] = useState<Record<string, string>>({});

  const stepPalette = ['#036FE3', '#008539', '#CC4500', '#DA294A', '#6C1FB3', '#00A3C7', '#E2B203'];

  useEffect(() => {
    // Register configuration handler
    sdk.app.onConfigure(() => {
      return {
        parameters: {},
      };
    });

    // Signal that the app is ready to be displayed
    sdk.app.setReady();
  }, [sdk]);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the CMA to fetch workflow definitions
        const response = await sdk.cma.workflowDefinition.getMany({});
        
        const workflowData: WorkflowDefinition[] = response.items.map((item: any) => ({
          sys: { id: item.sys.id },
          name: item.name,
          steps: item.steps?.map((step: any) => ({
            id: step.id,
            name: step.name,
          })) || [],
        }));

        setWorkflows(workflowData);
      } catch (err: any) {
        console.error('Error fetching workflows:', err);
        setError(err.message || 'Failed to fetch workflow definitions');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [sdk.cma]);

  useEffect(() => {
    if (currentTab !== 'entries') return;
    if (Object.keys(contentTypeDisplayFieldById).length > 0) return;

    const fetchContentTypes = async () => {
      try {
        const response = await sdk.cma.contentType.getMany({ query: { limit: 1000 } });
        const nextMap: Record<string, string> = {};
        for (const ct of response.items ?? []) {
          const id = ct?.sys?.id;
          const displayField = ct?.displayField;
          if (typeof id === 'string' && typeof displayField === 'string') {
            nextMap[id] = displayField;
          }
        }
        setContentTypeDisplayFieldById(nextMap);
      } catch (err) {
        // Non-fatal: we'll fall back to entry IDs if we can't resolve titles
        console.warn('[ConfigScreen] Failed to load content types for displayField mapping', err);
      }
    };

    fetchContentTypes();
  }, [currentTab, sdk.cma, contentTypeDisplayFieldById]);

  const getBestLocaleValue = (localizedValue: any) => {
    if (!localizedValue || typeof localizedValue !== 'object') return undefined;

    // Prefer the default locale if available
    const defaultLocale = (sdk as any)?.locales?.default;
    if (typeof defaultLocale === 'string' && defaultLocale in localizedValue) {
      return localizedValue[defaultLocale];
    }

    // Otherwise take the first locale value
    const firstKey = Object.keys(localizedValue)[0];
    return firstKey ? localizedValue[firstKey] : undefined;
  };

  const toHumanString = (value: any) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return undefined;
  };

  const fetchEntryTitlesByIds = async (entryIds: string[]) => {
    const unique = Array.from(new Set(entryIds)).filter(Boolean);
    // If we previously fell back to showing the ID as the "title", treat that as missing
    // so we can re-fetch once we have content type displayField info.
    const missing = unique.filter((id) => !(id in entryTitleById) || entryTitleById[id] === id);
    if (missing.length === 0) return;

    // CMA entries getMany can take sys.id[in] comma-separated. Chunk to keep URLs reasonable.
    const chunkSize = 50;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      try {
        const resp = await sdk.cma.entry.getMany({
          query: {
            'sys.id[in]': chunk.join(','),
            limit: chunk.length,
          },
        });

        const updates: Record<string, string> = {};
        for (const entry of resp.items ?? []) {
          const id = entry?.sys?.id;
          const contentTypeId = entry?.sys?.contentType?.sys?.id;
          if (typeof id !== 'string') continue;

          const displayField =
            typeof contentTypeId === 'string' ? contentTypeDisplayFieldById[contentTypeId] : undefined;

          const candidateFieldNames = [
            displayField,
            'title',
            'name',
            'internalName',
            'headline',
            'slug',
          ].filter((x): x is string => typeof x === 'string' && x.length > 0);

          let best: string | undefined;
          for (const fieldName of candidateFieldNames) {
            const fieldValue = entry?.fields?.[fieldName];
            const localized = getBestLocaleValue(fieldValue);
            const asString = toHumanString(localized);
            if (asString) {
              best = asString;
              break;
            }
          }

          updates[id] = best ?? id;
        }

        if (Object.keys(updates).length > 0) {
          setEntryTitleById((prev) => ({ ...prev, ...updates }));
        }
      } catch (err) {
        // Non-fatal: leave missing IDs to fall back in UI
        console.warn('[ConfigScreen] Failed to fetch entry titles', err);
      }
    }
  };

  const openWorkflowInWebApp = (workflowDefinitionId: string) => {
    if (!workflowDefinitionId) return;
    // Contentful UI route for a workflow definition
    const url = `https://app.contentful.com/spaces/${sdk.ids.space}/environments/${sdk.ids.environment}/workflows/${workflowDefinitionId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (currentTab !== 'entries') return;

    const fetchWorkflowInstances = async () => {
      try {
        setWorkflowInstancesLoading(true);
        setWorkflowInstancesError(null);

        const query: any = {
          limit: workflowInstancesLimit,
          skip: 0,
          order: '-sys.updatedAt',
        };

        if (selectedWorkflowDefinitionId !== 'all') {
          query['sys.workflowDefinition.sys.id'] = selectedWorkflowDefinitionId;
        }
        if (selectedStepId !== 'all') {
          query['stepId[in]'] = selectedStepId;
        }

        const response = await sdk.cma.workflow.getMany({ query });
        setWorkflowInstances(response.items ?? []);
        setWorkflowInstancesTotal(typeof response.total === 'number' ? response.total : null);
        setWorkflowInstancesSkip(0);

        const entryIds = (response.items ?? [])
          .map((wf: any) => wf?.sys?.entity?.sys?.id)
          .filter((id: any) => typeof id === 'string');
        await fetchEntryTitlesByIds(entryIds);
      } catch (err: any) {
        console.error('Error fetching workflow instances:', err);
        setWorkflowInstancesError(err.message || 'Failed to fetch workflow instances');
      } finally {
        setWorkflowInstancesLoading(false);
      }
    };

    fetchWorkflowInstances();
  }, [currentTab, sdk.cma, selectedWorkflowDefinitionId, selectedStepId]);

  const loadMoreWorkflowInstances = async () => {
    try {
      setWorkflowInstancesLoading(true);
      setWorkflowInstancesError(null);

      const nextSkip = workflowInstancesSkip + workflowInstancesLimit;
      const query: any = {
        limit: workflowInstancesLimit,
        skip: nextSkip,
        order: '-sys.updatedAt',
      };

      if (selectedWorkflowDefinitionId !== 'all') {
        query['sys.workflowDefinition.sys.id'] = selectedWorkflowDefinitionId;
      }
      if (selectedStepId !== 'all') {
        query['stepId[in]'] = selectedStepId;
      }

      const response = await sdk.cma.workflow.getMany({ query });
      setWorkflowInstances((prev) => [...prev, ...(response.items ?? [])]);
      setWorkflowInstancesTotal(typeof response.total === 'number' ? response.total : workflowInstancesTotal);
      setWorkflowInstancesSkip(nextSkip);

      const entryIds = (response.items ?? [])
        .map((wf: any) => wf?.sys?.entity?.sys?.id)
        .filter((id: any) => typeof id === 'string');
      await fetchEntryTitlesByIds(entryIds);
    } catch (err: any) {
      console.error('Error fetching more workflow instances:', err);
      setWorkflowInstancesError(err.message || 'Failed to fetch more workflow instances');
    } finally {
      setWorkflowInstancesLoading(false);
    }
  };

  const selectedWorkflow =
    selectedWorkflowDefinitionId === 'all'
      ? null
      : workflows.find((w) => w.sys.id === selectedWorkflowDefinitionId) ?? null;

  const availableSteps =
    selectedWorkflowDefinitionId === 'all'
      ? workflows.flatMap((w) => w.steps.map((s) => ({ workflowId: w.sys.id, ...s })))
      : selectedWorkflow?.steps ?? [];

  const getStepColor = (workflowDefinitionId: string, stepId?: string) => {
    if (!stepId) return undefined;
    const wf = workflows.find((w) => w.sys.id === workflowDefinitionId);
    const step: any = wf?.steps.find((s) => s.id === stepId);
    const maybeColor = step?.color ?? step?.uiColor ?? step?.colour;
    if (typeof maybeColor === 'string' && maybeColor.length > 0) return maybeColor;
    const idx = wf?.steps.findIndex((s) => s.id === stepId) ?? 0;
    return stepPalette[Math.max(0, idx) % stepPalette.length];
  };

  const workflowInstancesHasMore =
    workflowInstancesTotal !== null
      ? workflowInstancesSkip + workflowInstances.length < workflowInstancesTotal
      : false;

  if (loading) {
    return (
      <Flex 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center"
        style={{ minHeight: '300px', padding: '40px' }}
      >
        <Spinner size="large" />
        <Text marginTop="spacingM">Loading workflow definitions...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex 
        flexDirection="column" 
        style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}
      >
        <Note variant="negative" title="Error loading workflows">
          {error}
        </Note>
      </Flex>
    );
  }

  return (
    <Flex 
      flexDirection="column" 
      style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px' }}
    >
      <Tabs currentTab={currentTab} onTabChange={(id) => setCurrentTab(id as any)}>
        <Tabs.List variant="horizontal-divider">
          <Tabs.Tab panelId="definitions">Definitions</Tabs.Tab>
          <Tabs.Tab panelId="entries">Entries</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="definitions">
          <Heading marginBottom="spacingL">Workflow Definitions</Heading>

          {workflows.length === 0 ? (
            <Note variant="warning">
              No workflow definitions found in this environment.
            </Note>
          ) : (
            workflows.map((workflow) => (
              <Box 
                key={workflow.sys.id} 
                marginBottom="spacingXl"
                style={{ 
                  border: '1px solid #e5e5e5', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <Box 
                  padding="spacingM" 
                  style={{ backgroundColor: '#f7f9fa', borderBottom: '1px solid #e5e5e5' }}
                >
                  <Flex justifyContent="space-between" alignItems="center">
                    <Heading as="h2" marginBottom="none">
                      {workflow.name}
                    </Heading>
                    <Badge variant="secondary">ID: {workflow.sys.id}</Badge>
                  </Flex>
                </Box>
                
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Step Name</TableCell>
                      <TableCell>Step ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workflow.steps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Text fontColor="gray500">No steps defined</Text>
                        </TableCell>
                      </TableRow>
                    ) : (
                      workflow.steps.map((step, index) => (
                        <TableRow key={step.id}>
                          <TableCell>
                            <Flex alignItems="center" gap="spacingXs">
                              <Badge variant="primary">{index + 1}</Badge>
                              <Text>{step.name}</Text>
                            </Flex>
                          </TableCell>
                          <TableCell>
                            <Text fontFamily="monospace" fontSize="fontSizeS">
                              {step.id}
                            </Text>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            ))
          )}
        </Tabs.Panel>

        <Tabs.Panel id="entries">
          <Heading marginBottom="spacingL">Workflow Entries</Heading>
          <Flex flexDirection="column" gap="spacingM">
            <Flex gap="spacingM" flexWrap="wrap" alignItems="flex-end">
              <FormControl style={{ minWidth: 280 }}>
                <FormControl.Label>Workflow</FormControl.Label>
                <Select
                  id="workflowDefinitionSelect"
                  name="workflowDefinitionSelect"
                  value={selectedWorkflowDefinitionId}
                  onChange={(e) => {
                    setSelectedWorkflowDefinitionId(e.target.value);
                    setSelectedStepId('all');
                  }}
                >
                  <Select.Option value="all">All workflows</Select.Option>
                  {workflows.map((w) => (
                    <Select.Option key={w.sys.id} value={w.sys.id}>
                      {w.name}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>

              <FormControl style={{ minWidth: 280 }}>
                <FormControl.Label>Stage</FormControl.Label>
                <Select
                  id="workflowStepSelect"
                  name="workflowStepSelect"
                  value={selectedStepId}
                  onChange={(e) => setSelectedStepId(e.target.value)}
                >
                  <Select.Option value="all">All stages</Select.Option>
                  {availableSteps.map((s: any) => (
                    <Select.Option key={`${s.workflowId ?? selectedWorkflowDefinitionId}:${s.id}`} value={s.id}>
                      {selectedWorkflowDefinitionId === 'all' ? `${s.name} (${s.id})` : s.name}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
            </Flex>

            {workflowInstancesLoading ? (
              <Flex alignItems="center" gap="spacingS">
                <Spinner size="small" />
                <Text>Loading workflow entries...</Text>
              </Flex>
            ) : workflowInstancesError ? (
              <Note variant="negative" title="Error loading workflow entries">
                {workflowInstancesError}
              </Note>
            ) : (
              <Box>
                <Flex justifyContent="space-between" alignItems="center" marginBottom="spacingS">
                  <Text fontColor="gray600">
                    Showing {workflowInstances.length}
                    {workflowInstancesTotal !== null ? ` of ${workflowInstancesTotal}` : ''} workflow instances
                  </Text>
                </Flex>

                {workflowInstances.length === 0 ? (
                  <Note variant="warning">No workflow instances found for this filter.</Note>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Entry</TableCell>
                        <TableCell>Workflow</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {workflowInstances.map((wf: any) => {
                        const workflowDefinitionId = wf?.sys?.workflowDefinition?.sys?.id ?? '';
                        const entryId = wf?.sys?.entity?.sys?.id ?? '';
                        const stepId = wf?.stepId ?? '';
                        const stepColor = getStepColor(workflowDefinitionId, stepId);
                        const workflowName =
                          workflows.find((w) => w.sys.id === workflowDefinitionId)?.name ?? workflowDefinitionId;
                        const stepName =
                          workflows
                            .find((w) => w.sys.id === workflowDefinitionId)
                            ?.steps.find((s) => s.id === stepId)?.name ?? stepId;

                        return (
                          <TableRow key={wf?.sys?.id ?? `${workflowDefinitionId}:${entryId}:${stepId}`}>
                            <TableCell>
                              {entryId ? (
                                <Button
                                  variant="transparent"
                                  size="small"
                                  onClick={() => sdk.navigator.openEntry(entryId)}
                                >
                                  <Text>{entryTitleById[entryId] ?? entryId}</Text>
                                </Button>
                              ) : (
                                <Text fontColor="gray500">—</Text>
                              )}
                            </TableCell>
                            <TableCell>
                              {workflowDefinitionId ? (
                                <Button
                                  variant="transparent"
                                  size="small"
                                  onClick={() => openWorkflowInWebApp(workflowDefinitionId)}
                                >
                                  <Text>{workflowName || workflowDefinitionId}</Text>
                                </Button>
                              ) : (
                                <Text fontColor="gray500">—</Text>
                              )}
                            </TableCell>
                            <TableCell>
                              {stepId ? (
                                <Badge
                                  variant="secondary"
                                  style={{
                                    backgroundColor: stepColor ?? undefined,
                                    color: stepColor ? '#fff' : undefined,
                                    borderColor: stepColor ?? undefined,
                                  }}
                                >
                                  {stepName || stepId}
                                </Badge>
                              ) : (
                                <Text fontColor="gray500">—</Text>
                              )}
                            </TableCell>
                            <TableCell>
                              <Text fontColor="gray600" fontSize="fontSizeS">
                                {wf?.sys?.updatedAt ?? '—'}
                              </Text>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}

            {workflowInstancesHasMore ? (
              <Flex>
                <Button
                  variant="secondary"
                  isDisabled={workflowInstancesLoading}
                  onClick={loadMoreWorkflowInstances}
                >
                  Load more
                </Button>
              </Flex>
            ) : null}
          </Flex>
        </Tabs.Panel>
      </Tabs>
    </Flex>
  );
};

export default ConfigScreen;
