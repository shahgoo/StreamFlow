import { test, expect } from '@playwright/test';

test.describe('Bibliothèque StreamFlow & Fluidité', () => {
  test.beforeEach(async ({ page }) => {
    // Injecter des clés et un cache mocké complet
    await page.addInitScript(() => {
      localStorage.setItem('ad_apikey', 'mock_ad_api_key_12345');
      localStorage.setItem('ad_api_key', 'mock_ad_api_key_12345');
      localStorage.setItem('tmdb_apikey', 'mock_tmdb_api_key_12345');
      localStorage.setItem('tmdb_api_key', 'mock_tmdb_api_key_12345');

      const mockMagnets = [
        {
          id: 101,
          filename: 'Inception.2010.MULTi.1080p.mkv',
          size: 4200000000,
          hash: 'hash1',
          status: 'Ready',
          statusCode: 4,
          downloaded: 4200000000,
          uploaded: 0,
          seeders: 10,
          downloadSpeed: 0,
          uploadSpeed: 0,
          uploadDate: 1700000000,
          completionDate: 1700000000,
          mediaType: 'movie',
          links: [{ filename: 'Inception.2010.MULTi.1080p.mkv', link: 'https://example.com/stream1' }],
          tmdbData: {
            id: 27205,
            title: 'Inception',
            poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
            backdrop_path: '/s3TBrRGB1jav7cUSaemIRvJu1v1.jpg',
            genre_ids: [28, 878, 12],
            overview: 'Dom Cobb est un voleur expérimenté...'
          }
        },
        {
          id: 102,
          filename: 'Breaking.Bad.S01E01.720p.mkv',
          size: 1500000000,
          hash: 'hash2',
          status: 'Ready',
          statusCode: 4,
          downloaded: 1500000000,
          uploaded: 0,
          seeders: 5,
          downloadSpeed: 0,
          uploadSpeed: 0,
          uploadDate: 1700000100,
          completionDate: 1700000100,
          mediaType: 'tv',
          showName: 'Breaking Bad',
          links: [{ filename: 'Breaking.Bad.S01E01.720p.mkv', link: 'https://example.com/stream2' }],
          tmdbData: {
            id: 1396,
            name: 'Breaking Bad',
            poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
            genre_ids: [18, 80],
            overview: 'Un professeur de chimie...'
          }
        },
        {
          id: 103,
          filename: 'Under.Siege.1.1992.1080p.mkv',
          size: 3500000000,
          hash: 'hash3',
          status: 'Ready',
          statusCode: 4,
          downloaded: 3500000000,
          uploaded: 0,
          seeders: 8,
          downloadSpeed: 0,
          uploadSpeed: 0,
          uploadDate: 1700000200,
          completionDate: 1700000200,
          mediaType: 'movie',
          links: [{ filename: 'Under.Siege.1.1992.1080p.mkv', link: 'https://example.com/stream3' }],
          tmdbData: {
            id: 9456,
            title: 'Under Siege',
            poster_path: '/path_under_siege.jpg',
            belongs_to_collection: {
              id: 9991,
              name: 'Under Siege Collection',
              poster_path: null
            }
          }
        },
        {
          id: 104,
          filename: 'Under.Siege.2.Dark.Territory.1995.1080p.mkv',
          size: 3800000000,
          hash: 'hash4',
          status: 'Ready',
          statusCode: 4,
          downloaded: 3800000000,
          uploaded: 0,
          seeders: 4,
          downloadSpeed: 0,
          uploadSpeed: 0,
          uploadDate: 1700000300,
          completionDate: 1700000300,
          mediaType: 'movie',
          links: [{ filename: 'Under.Siege.2.Dark.Territory.1995.1080p.mkv', link: 'https://example.com/stream4' }],
          tmdbData: {
            id: 9457,
            title: 'Under Siege 2: Dark Territory',
            poster_path: '/path_under_siege2.jpg',
            belongs_to_collection: {
              id: 9991,
              name: 'Under Siege Collection',
              poster_path: null
            }
          }
        }
      ];

      localStorage.setItem('sf_enriched_library_cache', JSON.stringify(mockMagnets));
      localStorage.setItem('sf_enriched_library_time', Date.now().toString());
    });
  });

  test('La bibliothèque charge instantanément les films du cache', async ({ page }) => {
    await page.goto('/');

    // Vérifier la présence des onglets principaux
    await expect(page.getByRole('button', { name: 'Films' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Séries' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tout' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Favoris', exact: true })).toBeVisible();

    // La carte Inception dans la grille principale doit être visible
    const gridCards = page.locator('.grid');
    await expect(gridCards.getByText('Inception')).toBeVisible();
  });

  test('Le changement d onglet filtre correctement Films et Séries sans rechargement', async ({ page }) => {
    await page.goto('/');

    // Onglet Séries
    await page.getByRole('button', { name: 'Séries' }).click();
    await expect(page.locator('.grid').getByText('Breaking Bad')).toBeVisible();
    await expect(page.locator('.grid').getByText('Inception')).not.toBeVisible();

    // Onglet Tout
    await page.getByRole('button', { name: 'Tout' }).first().click();
    await expect(page.locator('.grid').getByText('Breaking Bad')).toBeVisible();
    await expect(page.locator('.grid').getByText('Inception')).toBeVisible();
  });

  test('La recherche textuelle filtre en temps réel et persiste', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('Rechercher...');
    await searchInput.fill('Inception');

    // Seul Inception doit rester dans la grille
    await expect(page.locator('.grid').getByText('Inception')).toBeVisible();
    await expect(page.locator('.grid').getByText('Under Siege')).not.toBeVisible();

    // Vider la recherche
    await searchInput.fill('');
    await expect(page.locator('.grid').getByText('Inception')).toBeVisible();
  });

  test('La modale de création de collection s ouvre et se ferme proprement', async ({ page }) => {
    await page.goto('/');

    const addColBtn = page.getByRole('button', { name: /\+ Collection/i });
    await expect(addColBtn).toBeVisible();
    await addColBtn.click();

    // La modale doit s'ouvrir
    await expect(page.getByRole('heading', { name: /Créer une Collection/i })).toBeVisible();
    const nameInput = page.getByPlaceholder('ex: Saga Spiderman, Collection Western...');
    await expect(nameInput).toBeVisible();

    // Fermer la modale
    const cancelBtn = page.getByRole('button', { name: 'Annuler' });
    await cancelBtn.click();
    await expect(page.getByRole('heading', { name: /Créer une Collection/i })).not.toBeVisible();
  });
});
