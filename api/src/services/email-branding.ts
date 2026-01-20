export function appendJoineryAiFooterText(text: string): string {
	const raw = String(text ?? "");
	if (/joineryai\.app/i.test(raw) || /powered by\s+joineryai/i.test(raw)) return raw;
	const trimmed = raw.replace(/\s+$/g, "");
	const footer = "\n\n—\nPowered by JoineryAI — https://www.joineryai.app";
	return trimmed + footer;
}

export function appendJoineryAiFooterHtml(html: string): string {
	const raw = String(html ?? "");
	if (/joineryai\.app/i.test(raw) || /powered by\s+joineryai/i.test(raw)) return raw;
	const trimmed = raw.replace(/\s+$/g, "");
	const footer =
		'<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />' +
		'<p style="font-size:12px;line-height:1.4;color:#64748b;margin:0">' +
		'Powered by <a href="https://www.joineryai.app" target="_blank" rel="noreferrer">JoineryAI</a>' +
		'</p>';
	return trimmed + footer;
}
