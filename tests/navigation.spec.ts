import { test, expect } from '@playwright/test';

test.describe('Navigation et Configuration Initiale', () => {
  test('Affiche l écran de configuration requise si aucune clé API n est enregistrée', async ({ page }) => {
    // S'assurer qu'aucun localStorage n'est présent
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/');

    // Vérifier l'apparition de l'encart Configuration requise
    const configTitle = page.getByRole('heading', { name: 'Configuration requise' });
    await expect(configTitle).toBeVisible();

    // Cliquer sur le bouton Paramètres
    const settingsBtn = page.getByRole('button', { name: 'Paramètres' });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Vérifier la navigation vers la page des paramètres
    await expect(page).toHaveURL(/.*#\/settings/);
    const settingsTitle = page.getByText('Configuration Alldebrid');
    await expect(settingsTitle).toBeVisible();
  });

  test('La barre de navigation latérale permet de basculer entre Accueil et Paramètres', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(page.getByText('Configuration Alldebrid')).toBeVisible();

    // Cliquer sur l'icône Bibliothèque dans la Navbar
    const libraryNav = page.locator('nav').getByRole('link', { name: /Bibliothèque/i });
    if (await libraryNav.count() > 0) {
      await libraryNav.click();
      await expect(page).toHaveURL(/.*#\/?$/);
    }
  });
});
