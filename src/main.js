/* eslint-disable import/no-cycle */
import { loadBot,
  loadCommands,
  loadSkriptHubAPI,
  loadSkripttoolsAddons,
  loadDatabases,
  loadConfig,
  loadEvents } from './setup';
import SanctionManager from './structures/SanctionManager';
import loadRssFeed from './structures/RSSFeed';
import loadSkriptReleases from './structures/skriptReleases';
import Command from './structures/Command';
import Logger from './structures/Logger';

export const logger = new Logger();
export const config = loadConfig();

export const commands = [];
export const sanctions = [];

loadCommands();

export const db = loadDatabases();
export const client = loadBot();

loadEvents(client);

const shouldLoadSyntaxes = config.messages.commands.syntaxinfo.enabled ?? true;
const shouldLoadAddons = config.messages.commands.addoninfo.enabled ?? true;
export const SkriptHubSyntaxes = shouldLoadSyntaxes ? loadSkriptHubAPI() : null;
export const SkripttoolsAddons = shouldLoadAddons ? loadSkripttoolsAddons() : null;

client.on('ready', async () => {
  logger.debug('main.js -> Client is ready (client.on(\'ready\'))');
  const guild = client.guilds.resolve(config.bot.guild);

  // Verifying tokens and ids
  if (!process.env.DISCORD_API) throw new Error('Discord token was not set in the environment variables (DISCORD_API)');
  if (!process.env.YOUTUBE_API) throw new Error('Youtube token was not set in the environment variables (YOUTUBE_API)');
  if (!process.env.SUGGESTION) throw new Error('Suggestion channel ID was not set in the environment variables (SUGGESTION)');
  if (!process.env.BOT) throw new Error('Bot id was not set in the environment variables (BOT)');
  if (!process.env.GUILD) throw new Error('Guild id was not set in the environment variables (GUILD)');
  for (const [key, value] of Object.entries(config.channels)) {
    if (!value) logger.warn(`config.channels.${key} is not set. You may want to fill this field to avoid any error.`);
    else if (!guild.channels.cache.has(value)) logger.warn(`The id entered for config.channels.${key} is not a valid channel.`);
  }
  for (const [key, value] of Object.entries(config.roles)) {
    if (!value) logger.warn(`config.roles.${key} is not set. You may want to fill this field to avoid any error.`);
    else if (!guild.roles.cache.has(value)) logger.warn(`The id entered for config.roles.${key} is not a valid role.`);
  }

  logger.debug('main.js -> Checks of tokens and ids finished successfully');

  // Initializing the commands-stats database
  for (const command of commands) {
    const docs = await db.commandsStats.find({ command: command.name })
      .catch(console.error);
    if (docs.length > 0) continue;

    await db.commandsStats.insert({ command: command.name, used: 0 })
      .catch(console.error);
  }
  logger.debug('main.js -> commandsStats database initialized successfully');

  // Cache all messages that need to be cached
  const suggestionChannel = client.channels.cache.get(config.channels.suggestion);
  const suggestionMessages = await suggestionChannel.messages.fetch({ limit: 100 }, true);
  logger.step(`Messages cached! (${suggestionMessages.size})`);

  client.user.setActivity(config.bot.activity_on, { type: 'WATCHING' });
  client.guild = guild;
  client.config = {};
  client.config.activated = true;

  logger.step('Skript-MC bot loaded!', true);

  setInterval(() => {
    // Tri dans les cooldowns des commandes
    Command.filterCooldown(commands);
    // Vérification des sanctions temporaires
    SanctionManager.checkSanctions(guild);
    // Chargement des flux RSS
    loadRssFeed();
    // Vérification si une nouvelle version de Skript est sortie
    loadSkriptReleases();
    // On remet l'activité du bot (sinon elle s'enlève toute seule au bout d'un moment)
    client.user.setActivity(config.bot.activity_on, { type: 'WATCHING' });
  }, config.bot.checkInterval);
});

client.on('error', (err) => { throw new Error(err); });
client.on('warn', logger.warn);

if (process.env.NODE_ENV !== 'development') {
  process.on('uncaughtException', (err) => { throw new Error(err); });
  process.on('unhandledRejection', (err) => { throw new Error(err); });
}
