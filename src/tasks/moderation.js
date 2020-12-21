import messages from '../../config/messages';
import settings from '../../config/settings';
import Sanction from '../models/sanction';
import ModerationData from '../moderation/ModerationData';
import BanAction from '../moderation/actions/BanAction';
import RemoveWarnAction from '../moderation/actions/RemoveWarnAction';
import UnbanAction from '../moderation/actions/UnbanAction';
import UnmuteAction from '../moderation/actions/UnmuteAction';
import Task from '../structures/Task';
import { constants, noop } from '../utils';

class ModerationTask extends Task {
  constructor() {
    super('moderation', {
      // Every 10 seconds
      interval: 10_000,
    });
  }

  async exec() {
    const sanctions = await Sanction.find({
      revoked: false,
      finish: { $lte: Date.now(), $ne: -1 },
    });

    const channel = this.client.guild.channels.resolve(settings.channels.log);

    for (const sanction of sanctions) {
      /* eslint-disable no-await-in-loop */
      const { memberId } = sanction;

      const member = this.client.guild.member(memberId)
        || await this.client.guild.members.fetch(memberId).catch(noop);

      const user = member?.user
        || this.client.users.resolve(memberId)
        || await this.client.users.fetch(memberId).catch(noop);

      if (!member && !user)
        continue;

      switch (sanction.type) {
        case constants.SANCTIONS.TYPES.BAN: {
          const data = new ModerationData(this.client.guild.me, this.client.guild, this.client, channel)
            .setVictim(member || user, false);

          if (sanction.informations?.hasSentMessage) {
            data.setReason(messages.moderation.reasons.autoRevoke)
              .setType(constants.SANCTIONS.TYPES.UNBAN);
            await new UnbanAction(data).commit();
          } else {
            data.setReason(messages.moderation.reasons.autoBanInactivity)
              .setType(constants.SANCTIONS.TYPES.HARDBAN);
            await new BanAction(data).commit();
          }
          break;
        }

        case constants.SANCTIONS.TYPES.MUTE: {
          const data = new ModerationData(this.client.guild.me, this.client.guild, this.client, channel)
            .setVictim(member || user, false)
            .setReason(messages.moderation.reasons.autoRevoke)
            .setType(constants.SANCTIONS.TYPES.UNMUTE);

          await new UnmuteAction(data).commit();
          break;
        }

        case constants.SANCTIONS.TYPES.WARN: {
          const data = new ModerationData(this.client.guild.me, this.client.guild, this.client, channel)
            .setVictim(member || user, false)
            .setReason(messages.moderation.reasons.autoRevoke)
            .setType(constants.SANCTIONS.TYPES.REMOVE_WARN);

          await new RemoveWarnAction(data).commit();
          break;
        }
      }
    }
  }
}

export default ModerationTask;