export type TechRule = {
    name: string;
    headers?: { [key: string]: RegExp };
    scripts?: RegExp[];
    meta?: { [name: string]: RegExp };
    window?: string[];
    html?: RegExp[];
    robots?: RegExp[];
};

export const TECH_RULES: TechRule[] = [
    // CMS
    { 
        name: 'WordPress', 
        meta: { generator: /WordPress/i }, 
        scripts: [/\/wp-content\//, /\/wp-includes\//], 
        robots: [/\/wp-admin\//i],
        html: [/class=".*wp-block-/i]
    },
    { 
        name: 'Shopify', 
        window: ['Shopify'], 
        scripts: [/shopify\.com/i, /cdn\.shopify\.com/i] 
    },
    { 
        name: 'Tilda', 
        meta: { generator: /Tilda/i },
        html: [/tilda\.ws/i, /Made on Tilda/i] 
    },
    { 
        name: 'Wix', 
        meta: { generator: /Wix\.com/i }, 
        window: ['wixData', 'wixBiSession'],
        headers: { 'x-wix-request-id': /.*/ }
    },
    { 
        name: 'Joomla!', 
        meta: { generator: /Joomla!/i }, 
        robots: [/\/administrator\//i],
        html: [/com_content/i]
    },
    { 
        name: '1C-Bitrix', 
        headers: { 'X-Powered-CMS': /Bitrix/i, 'Set-Cookie': /BITRIX_/i }, 
        html: [/bitrix\/js/i, /bitrix\/templates/i],
        window: ['BX']
    },
    { 
        name: 'Drupal', 
        meta: { generator: /Drupal/i }, 
        window: ['Drupal'],
        html: [/sites\/default\/files/i]
    },

    // Фреймворки
    { name: 'React', window: ['React', '__REACT_ROOT__', 'ReactDOM'], scripts: [/react\.js/, /react-dom\.js/] },
    { name: 'Vue.js', window: ['Vue', '__VUE__'], scripts: [/vue\.js/, /vue\.min\.js/], html: [/data-v-[\da-f]{8}/i] },
    { name: 'Next.js', window: ['__NEXT_DATA__'], headers: {'x-nextjs-cache': /.*/i} },
    { name: 'Nuxt.js', window: ['__NUXT__'] },
    { name: 'Angular', window: ['ng'], html: [/ng-version/i] },
    { name: 'jQuery', window: ['jQuery', '$'], scripts: [/jquery\.js/, /jquery\.min\.js/] },
    { name: 'Svelte', window: ['__svelte__'] },

    // Аналитика и Маркетинг
    { name: 'Google Analytics', window: ['gtag', 'dataLayer', 'ga'], scripts: [/googletagmanager\.com/, /google-analytics\.com/] },
    { name: 'Yandex.Metrika', window: ['ym', 'Ya.Metrika'], scripts: [/mc\.yandex\.ru/] },
    { name: 'Meta Pixel', window: ['fbq'], scripts: [/connect\.facebook\.net/] },
    { name: 'Google Tag Manager', window: ['dataLayer'], scripts: [/gtm\.js/] },
    { name: 'Roistat', window: ['roistat'], scripts: [/cloud\.roistat\.com/] },
    
    // Веб-серверы
    { name: 'Nginx', headers: { server: /nginx/i } },
    { name: 'Apache', headers: { server: /Apache/i } },
    { name: 'Cloudflare', headers: { server: /cloudflare/i, 'Set-Cookie': /__cfduid/i } },
    { name: 'Varnish', headers: { 'x-varnish': /.*/i } },

    // Бэкенд
    { name: 'PHP', headers: { 'X-Powered-By': /PHP/i, 'Set-Cookie': /PHPSESSID/i } },
    { name: 'ASP.NET', headers: { 'X-Powered-By': /ASP\.NET/i, 'Set-Cookie': /ASP\.NET/i } },
    { name: 'Express.js', headers: { 'X-Powered-By': /Express/i } },
];
