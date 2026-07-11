
export interface ParsedMedia {
    title: string;
    year?: string;
    type: 'movie' | 'tv';
    originalName: string;
}

export const parseMagnetName = (filename: string): ParsedMedia => {
    let cleanName = filename;

    // 1. Extract Year first (before removing parens/brackets which might contain the year)
    // Matches 1990-2029 surrounded by delimiters or start/end
    const yearMatch = cleanName.match(/(?:^|[\[\(\s._-])((?:19|20)\d{2})(?:$|[\]\)\s._-])/);
    const year = yearMatch ? yearMatch[1] : undefined;

    // 2. Detect Series (S01E01, S01, Season 1, etc.)
    const seriesRegex = /(S\d{1,2}E\d{1,2}|S\d{1,2}|Season\s*\d+|Saison\s*\d+|Episode\s*\d+)/i;
    const isSeries = seriesRegex.test(cleanName);

    // 3. Basic Cleaning
    cleanName = cleanName
        .replace(/\./g, ' ')
        .replace(/_/g, ' ')
        .replace(/\[.*?\]/g, '') // Remove [Tags]
        // Remove file extensions at the end
        .replace(/\.(mkv|mp4|avi|mov|wmv|m4v|webm|flv|mpg|mpeg|3gp|m2ts|ts|iso|rar|zip)$/i, ''); 

    // 4. Cut Garbage (Resolutions, Codecs, etc.)
    // We look for common scene tags and cut everything after
    const cutRegex = /(1080p|720p|2160p|4k|bluray|remux|web-dl|webrip|hdtv|x264|x265|hevc|hdr|dv|repack|proper|multi|frenc|vostfr|complete).*/i;
    cleanName = cleanName.replace(cutRegex, '');

    // 5. Specific Type Handling
    if (isSeries) {
        // Remove the series pattern (S01E01) and anything after
        cleanName = cleanName.replace(seriesRegex, '');
    } else if (year) {
        // For movies, if we found a year, usually the title is everything before it
        // We use the year found in step 1 to split
        const parts = cleanName.split(year);
        if (parts[0].length > 0) {
            cleanName = parts[0];
        }
    }

    // 6. Final cleanup (remove remaining parens, trim dashes/spaces)
    cleanName = cleanName
        .replace(/\(.*?\)/g, '') // Remove remaining (Text)
        .replace(/[-–]+$/, '')    // Remove trailing dashes
        .replace(/\s+/g, ' ')     // Collapse spaces
        .trim();

    return {
        title: cleanName,
        year,
        type: isSeries ? 'tv' : 'movie',
        originalName: filename
    };
};
