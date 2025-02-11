import { MedplumClient, created } from '@medplum/core';
import { main } from '.';

const testLineOutput = [
  `{"resourceType":"Patient", "id":"1111111"}`,
  `{"resourceType":"Patient", "id":"2222222"}`,
  `{"resourceType":"Patient", "id":"3333333"}`,
];
jest.mock('child_process');
jest.mock('http');
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: jest.fn(function* () {
      for (const line of testLineOutput) {
        yield line;
      }
    }),
  }),
}));

jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  writeFile: jest.fn((path, data, callback) => {
    callback();
  }),
  constants: {
    O_CREAT: 0,
  },
  promises: {
    readFile: jest.fn(async () => '{}'),
  },
}));

let medplum: MedplumClient;

describe('CLI Bulk Commands', () => {
  describe('export', () => {
    let fetch: any;

    beforeEach(() => {
      let count = 0;
      fetch = jest.fn(async (url) => {
        if (url.includes('/$export?_since=200')) {
          return {
            status: 200,
            json: jest.fn(async () => {
              return {
                resourceType: 'OperationOutcome',
                id: 'accepted',
                issue: [
                  {
                    severity: 'information',
                    code: 'informational',
                    details: {
                      text: 'Accepted',
                    },
                  },
                ],
              };
            }),
          };
        }

        if (url.includes('/$export')) {
          return {
            status: 202,
            json: jest.fn(async () => {
              return {
                resourceType: 'OperationOutcome',
                id: 'accepted',
                issue: [
                  {
                    severity: 'information',
                    code: 'informational',
                    details: {
                      text: 'Accepted',
                    },
                  },
                ],
              };
            }),
            headers: {
              get(name: string): string | undefined {
                return {
                  'content-location': 'bulkdata/id/status',
                }[name];
              },
            },
          };
        }

        if (url.includes('bulkdata/id/status')) {
          if (count < 1) {
            count++;
            return {
              status: 202,
              json: jest.fn(async () => {
                return {};
              }),
            };
          }
        }

        return {
          status: 200,
          json: jest.fn(async () => ({
            transactionTime: '2023-05-18T22:55:31.280Z',
            request: 'https://api.medplum.com/fhir/R4/$export?_type=Observation',
            requiresAccessToken: false,
            output: [
              {
                type: 'ProjectMembership',
                url: 'https://api.medplum.com/storage/20fabdd3-e036-49fc-9260-8a30eaffefb1/498475fe-5eb0-46e5-b9f4-b46943c9719b?Expires=1685749878&Key-Pair-Id=my-key-id&Signature=PWyrVFf',
              },
              {
                type: 'Project',
                url: 'https://sandbox.bcda.cms.gov/data/55555/aaaaaa-bbbbb-ccc-ddddd-eeeeee.ndjson',
              },
            ],
            error: [],
          })),
        };
      });
      jest.resetModules();
      jest.clearAllMocks();
      medplum = new MedplumClient({ fetch });

      console.log = jest.fn();
      console.error = jest.fn();
      process.exit = jest.fn() as never;
    });

    test('system', async () => {
      const medplumDownloadSpy = jest.spyOn(medplum, 'download').mockImplementation((): any => {
        return {
          text: jest.fn(),
        };
      });
      await main(medplum, ['node', 'index.js', 'bulk', 'export', '-t', 'Patient']);
      expect(medplumDownloadSpy).toBeCalled();
      expect(console.log).toBeCalledWith(
        expect.stringMatching(
          'ProjectMembership_storage_20fabdd3_e036_49fc_9260_8a30eaffefb1_498475fe_5eb0_46e5_b9f4_b46943c9719b.ndjson is created'
        )
      );
      expect(console.log).toBeCalledWith(
        expect.stringMatching('Project_data_55555_aaaaaa_bbbbb_ccc_ddddd_eeeeee_ndjson.ndjson is created')
      );
    });
  });

  describe('import', () => {
    let fetch: any;

    beforeEach(() => {
      console.log = jest.fn();
      console.error = jest.fn();
      jest.resetModules();
      jest.clearAllMocks();
      fetch = jest.fn(async () => {
        return {
          status: 200,
          json: jest.fn(async () => ({
            resourceType: 'Bundle',
            type: 'transaction-response',
            entry: [
              {
                response: {
                  outcome: created,
                  status: '201',
                },
                resource: {
                  resourceType: 'QuestionnaireResponse',
                },
              },
            ],
          })),
        };
      });
    });

    test('success', async () => {
      medplum = new MedplumClient({ fetch });
      await main(medplum, ['node', 'index.js', 'bulk', 'import', 'Patient.json']);

      testLineOutput.forEach((line) => {
        const resource = JSON.parse(line);
        expect(fetch).toBeCalledWith(
          expect.stringMatching(`/fhir/R4`),
          expect.objectContaining({
            body: expect.stringContaining(
              JSON.stringify({
                resource: resource,
                request: {
                  method: 'POST',
                  url: resource.resourceType,
                },
              })
            ),
          })
        );
      });
      expect(console.log).toBeCalledWith(expect.stringMatching(`"status": "201"`));
      expect(console.log).toBeCalledWith(expect.stringMatching(`"text": "Created"`));
    });

    test('success with option numResourcesPerRequest', async () => {
      medplum = new MedplumClient({ fetch });
      await main(medplum, ['node', 'index.js', 'bulk', 'import', 'Patient.json', '--numResourcesPerRequest', '1']);

      testLineOutput.forEach((line) => {
        const resource = JSON.parse(line);
        expect(fetch).toBeCalledWith(
          expect.stringMatching(`/fhir/R4`),
          expect.objectContaining({
            body: expect.stringContaining(
              JSON.stringify({
                resource: resource,
                request: {
                  method: 'POST',
                  url: resource.resourceType,
                },
              })
            ),
          })
        );
      });

      expect(fetch).toBeCalledTimes(3);
    });
  });
});
