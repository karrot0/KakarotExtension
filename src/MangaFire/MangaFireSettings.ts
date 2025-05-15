import {
    Form,
    Section,
    NavigationRow,
    InputRow,
    LabelRow,
} from '@paperback/types';

export function getRateLimit(): number {
    const rateLimit = Application.getState('rateLimit');
    return typeof rateLimit === 'number' ? rateLimit : 5;
}

export class MangaFireSettingsForm extends Form {
    override getSections(): Application.FormSectionElement[] {
       return [
            Section('mainSettings', [
                NavigationRow('rateLimitForm', {
                    title: 'Rate Limit',
                    form: new RateLimitForm(),
                }), 
            ])
        ];
    }
}

export class RateLimitForm extends Form {
    async rateLimitDidChange(value: string): Promise<void> {
        Application.setState('rateLimit', parseInt(value).toString());
    }

    override getSections(): Application.FormSectionElement[] {
        return [
            Section('rateLimitSection', [
                LabelRow('rateLimitLabel', {
                    title: 'Rate Limit',
                    value: "5",
                })
            ])
        ];
    }
}