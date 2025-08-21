import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';

export class CometApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CometAPI',
		name: 'cometApi',
		icon: 'file:cometApi.svg',
		group: ['transform'],
		version: 1,
		description: 'Interact with CometAPI large language models',
		defaults: {
			name: 'CometAPI',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'cometApi', required: true }],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'gpt-4o-mini',
				required: true,
				description: 'The model to use for completion',
				placeholder: 'gpt-4o-mini',
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				default: {
					values: [
						{
							role: 'user',
							content: '',
						},
					],
				},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						name: 'values',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{
										name: 'User',
										value: 'user',
									},
									{
										name: 'Assistant',
										value: 'assistant',
									},
									{
										name: 'System',
										value: 'system',
									},
								],
								default: 'user',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								default: '',
								typeOptions: {
									rows: 2,
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: 4096,
						description:
							'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 32,768).',
						type: 'number',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Stream',
						name: 'stream',
						default: false,
						description:
							'Whether to send partial message deltas as data-only server-sent events as they become available',
						type: 'boolean',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
						type: 'number',
					},
				],
				default: {},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = (await this.getCredentials('cometApi')) as { apiKey: string };
		const apiKey = credentials.apiKey;

		for (let i = 0; i < items.length; i++) {
			const model = this.getNodeParameter('model', i) as string;
			const messages = this.getNodeParameter('messages.values', i, []) as Array<{
				role: string;
				content: string;
			}>;
			const options = this.getNodeParameter('options', i, {}) as {
				frequencyPenalty?: number;
				maxTokens?: number;
				presencePenalty?: number;
				stream?: boolean;
				temperature?: number;
				topP?: number;
			};

			// Validate messages
			const validMessages = messages.filter((msg) => msg.content && msg.content.trim().length > 0);
			if (validMessages.length === 0) {
				const errorMsg = 'At least one message with content is required';
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: errorMsg },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), errorMsg);
			}

			// Build request body with correct API parameter names
			const requestBody: any = {
				model,
				messages: validMessages,
			};

			// Map UI parameter names to API parameter names
			if (options.frequencyPenalty !== undefined)
				requestBody.frequency_penalty = options.frequencyPenalty;
			if (options.maxTokens !== undefined && options.maxTokens > 0)
				requestBody.max_tokens = options.maxTokens;
			if (options.presencePenalty !== undefined)
				requestBody.presence_penalty = options.presencePenalty;
			if (options.stream !== undefined) requestBody.stream = options.stream;
			if (options.temperature !== undefined) requestBody.temperature = options.temperature;
			if (options.topP !== undefined) requestBody.top_p = options.topP;

			try {
				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: 'https://api.cometapi.com/v1/chat/completions',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: requestBody,
					json: true,
				});

				returnData.push({
					json: response,
					pairedItem: { item: i },
				});
			} catch (error) {
				// More detailed error information
				const errorMessage =
					error.response?.data?.error?.message ||
					error.response?.data?.message ||
					error.message ||
					'Unknown error occurred';

				const errorDetails = {
					error: errorMessage,
					statusCode: error.response?.status,
					requestBody: requestBody,
					responseData: error.response?.data,
				};

				if (this.continueOnFail()) {
					returnData.push({
						json: errorDetails,
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
