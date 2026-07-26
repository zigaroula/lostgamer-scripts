const translations = {
    fr: {
        projectLabel: 'Userscript non officiel',
        summary: 'Quelques effets visuels pour modifier uniquement la vue panoramique de Lostgamer.',
        installLink: 'Installer le script',
        sourceLink: 'Voir le code',
        installationTitle: 'Installation',
        stepOne: 'Installez l’extension Tampermonkey dans votre navigateur.',
        stepTwo: 'Sur Chrome 138+, ouvrez les détails de Tampermonkey et activez « Autoriser les scripts utilisateur ».',
        stepThree: 'Cliquez sur « Installer le script », puis confirmez dans Tampermonkey.',
        browserNote: 'Ancien Chrome/Chromium : activez le Mode développeur dans chrome://extensions. Sur Edge : edge://extensions. Firefox n’utilise pas le même interrupteur.',
        modesTitle: 'Modes disponibles',
        shortcuts: 'Raccourcis',
        normal: 'Normal',
        grayscale: 'Noir et blanc',
        pixelLight: 'Pixelisé léger',
        pixelExtreme: 'Pixelisé extrême',
        blur: 'Flou',
        invert: 'Couleurs inversées',
        oneSecond: 'Visible 1 seconde',
        edges: 'Contours uniquement',
        panelShortcut: 'Alt+M réduit ou affiche le panneau.',
        footer: 'Script créé par Ziga.',
        languageLabel: 'Switch to English',
        metaDescription: 'Installation et modes disponibles pour le userscript Lostgamer Visual Effects.',
    },
    en: {
        projectLabel: 'Unofficial userscript',
        summary: 'A few visual effects that modify only the Lostgamer panorama.',
        installLink: 'Install the script',
        sourceLink: 'View source',
        installationTitle: 'Installation',
        stepOne: 'Install the Tampermonkey extension in your browser.',
        stepTwo: 'On Chrome 138+, open Tampermonkey’s details and enable “Allow User Scripts”.',
        stepThree: 'Click “Install the script”, then confirm in Tampermonkey.',
        browserNote: 'Older Chrome/Chromium: enable Developer mode in chrome://extensions. On Edge: edge://extensions. Firefox does not use the same toggle.',
        modesTitle: 'Available modes',
        shortcuts: 'Shortcuts',
        normal: 'Normal',
        grayscale: 'Black and white',
        pixelLight: 'Light pixelation',
        pixelExtreme: 'Extreme pixelation',
        blur: 'Blur',
        invert: 'Inverted colors',
        oneSecond: 'Visible for 1 second',
        edges: 'Edges only',
        panelShortcut: 'Alt+M hides or shows the panel.',
        footer: 'Script by Ziga.',
        languageLabel: 'Passer en français',
        metaDescription: 'Installation and available modes for the Lostgamer Visual Effects userscript.',
    },
};

const languageToggle = document.querySelector('.language-toggle');
const metaDescription = document.querySelector('meta[name="description"]');
let language = (navigator.languages?.[0] || navigator.language || 'en')
    .toLowerCase()
    .startsWith('fr') ? 'fr' : 'en';

function applyLanguage(nextLanguage) {
    language = nextLanguage;
    const copy = translations[language];

    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = copy[element.dataset.i18n];
    });
    metaDescription.content = copy.metaDescription;
    languageToggle.textContent = language === 'fr' ? 'EN' : 'FR';
    languageToggle.setAttribute('aria-label', copy.languageLabel);
}

languageToggle.addEventListener('click', () => {
    applyLanguage(language === 'fr' ? 'en' : 'fr');
});

applyLanguage(language);
