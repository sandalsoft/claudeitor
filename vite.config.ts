import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '127.0.0.1',
		port: 5173
	},
	preview: {
		host: '127.0.0.1'
	},
	ssr: {
		noExternal: [
			'@opentelemetry/api',
			'@opentelemetry/sdk-trace-node',
			'@opentelemetry/sdk-trace-base',
			'@opentelemetry/context-async-hooks',
			'@opentelemetry/resources',
			'@opentelemetry/core',
			'@opentelemetry/semantic-conventions'
		]
	}
});
