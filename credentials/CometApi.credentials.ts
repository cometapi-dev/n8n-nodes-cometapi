import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CometApi implements ICredentialType {
	name = 'cometApi';
	displayName = 'CometAPI API';
	documentationUrl = 'https://api.cometapi.com/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'CometAPI Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			placeholder: 'your-api-key-here',
			description:
				"Your CometAPI API Key, if you don't have one, please create it from 'https://api.cometapi.com/console/token'.",
		},
	];

	// This allows the credential to be used by other parts of n8n
	// stating how this credential is injected as part of the request
	// An example is the Http Request node that can make generic calls
	// reusing this credential
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.cometapi.com/v1',
			url: '/chat/completions',
			method: 'POST',
			headers: {
				Authorization: 'Bearer {{$credentials.apiKey}}',
				'Content-Type': 'application/json',
			},
			body: {
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'user',
						content: 'Hello!',
					},
				],
				max_tokens: 5,
				stream: false,
			},
		},
	};
}
