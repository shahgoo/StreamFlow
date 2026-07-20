export interface ParsedMedia {
    title: string;
    year?: string;
    type: 'movie' | 'tv';
    originalName: string;
    
    // Infos qualité & audio
    quality?: '4K' | '1080p' | '720p' | 'SD';
    hdr?: boolean;
    dolbyVision?: boolean;
    audio?: string;
    
    // Infos séries
    season?: number;
    episode?: number;
    showName?: string; // Nom de la série sans saison/épisode pour le regroupement
}

export const videoExtensions = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|flv|mpg|mpeg|3gp|m2ts|ts)$/i;

export const isVideoFile = (filename: string): boolean => {
    return videoExtensions.test(filename);
};

export const parseMagnetName = (filename: string): ParsedMedia => {
    let cleanName = filename;

    // 1. Détection de la Qualité et HDR
    let quality: ParsedMedia['quality'] = undefined;
    if (/2160p|4k|uhd/i.test(cleanName)) quality = '4K';
    else if (/1080p|fhd/i.test(cleanName)) quality = '1080p';
    else if (/720p|hd/i.test(cleanName)) quality = '720p';
    else if (/dvd|sd|xvid|divx|webrip.*480p|web-dl.*480p/i.test(cleanName)) quality = 'SD';

    const hdr = /hdr|hdr10|hdr10\+/i.test(cleanName);
    const dolbyVision = /dv|dolby\s*vision|dovi/i.test(cleanName);

    // 2. Détection Audio
    let audio: string | undefined = undefined;
    if (/atmos/i.test(cleanName)) audio = 'Atmos';
    else if (/dts/i.test(cleanName)) audio = 'DTS';
    else if (/ac3|dd5\.1|dolby\s*digital/i.test(cleanName)) audio = 'Dolby 5.1';
    else if (/aac/i.test(cleanName)) audio = 'AAC';

    // 3. Extraction de l'année
    const yearMatch = cleanName.match(/(?:^|[\[\(\s._-])((?:19|20)\d{2})(?:$|[\]\)\s._-])/);
    const year = yearMatch ? yearMatch[1] : undefined;

    // 4. Détection des formats de séries (S01E01, S01, Season 1, etc.)
    let season: number | undefined = undefined;
    let episode: number | undefined = undefined;
    let isSeries = false;

    // Format S01E01 / s01e01
    const sxeMatch = cleanName.match(/s(\d{1,2})e(\d{1,2})/i);
    if (sxeMatch) {
        season = parseInt(sxeMatch[1], 10);
        episode = parseInt(sxeMatch[2], 10);
        isSeries = true;
    } else {
        // Format 1x02
        const xMatch = cleanName.match(/(\d{1,2})x(\d{1,2})/i);
        if (xMatch) {
            season = parseInt(xMatch[1], 10);
            episode = parseInt(xMatch[2], 10);
            isSeries = true;
        } else {
            // Format Season 1 ou Saison 1
            const seasonMatch = cleanName.match(/(?:\bseason\b|\bsaison\b|(?:^|[\s._\-\[\(])s)\s*(\d{1,2})(?:$|[\s._\-\]\)])/i);
            if (seasonMatch) {
                season = parseInt(seasonMatch[1], 10);
                isSeries = true;
            }
            // Format Episode 1
            const epMatch = cleanName.match(/(?:\bepisode\b|\bep\b|(?:^|[\s._\-\[\(])e)\s*(\d{1,2})(?:$|[\s._\-\]\)])/i);
            if (epMatch) {
                episode = parseInt(epMatch[1], 10);
                isSeries = true;
            }
        }
    }

    // 5. Nettoyage de base
    cleanName = cleanName
        .replace(/\./g, ' ')
        .replace(/_/g, ' ')
        .replace(/\[.*?\]/g, '') // Supprime les [Tags]
        // Supprime les extensions
        .replace(/\.(mkv|mp4|avi|mov|wmv|m4v|webm|flv|mpg|mpeg|3gp|m2ts|ts|iso|rar|zip)$/i, ''); 

    // Définir la regex de coupe des tags parasites
    const cutRegex = /(1080p|720p|2160p|4k|bluray|remux|web-dl|webrip|hdtv|x264|x265|hevc|hdr|dv|repack|proper|multi|frenc|vostfr|complete).*/i;

    let showName: string | undefined = undefined;

    if (isSeries) {
        // Pour les séries, le nom de la série est tout ce qui précède les motifs de saison/épisode
        const seriesRegex = /(s\d{1,2}e\d{1,2}|s\d{1,2}|season\s*\d+|saison\s*\d+|episode\s*\d+|\d{1,2}x\d{1,2})/i;
        const parts = cleanName.split(seriesRegex);
        if (parts[0] && parts[0].trim().length > 0) {
            showName = parts[0].replace(cutRegex, '').replace(/\s+/g, ' ').trim();
        }
        cleanName = showName || cleanName;
    } else if (year) {
        // Pour les films, le titre est tout ce qui précède l'année
        const parts = cleanName.split(year);
        if (parts[0] && parts[0].trim().length > 0) {
            cleanName = parts[0];
        }
    }

    // Nettoyage final (retrait des parenthèses restantes, tirets de fin, espaces multiples)
    cleanName = cleanName
        .replace(cutRegex, '')
        .replace(/\(.*?\)/g, '')
        .replace(/[-–]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Rendre showName identique à cleanName si c'est une série
    if (isSeries && !showName) {
        showName = cleanName;
    }

    return {
        title: cleanName,
        year,
        type: isSeries ? 'tv' : 'movie',
        originalName: filename,
        quality,
        hdr,
        dolbyVision,
        audio,
        season,
        episode,
        showName: isSeries ? showName : undefined
    };
};
