import ModerationAction from './ModerationAction';
import { config, db, client } from '../../main';
import ACTION_TYPE from './actionType';
import ModerationData from '../ModerationData';
import BanAction from './BanAction';

class WarnAction extends ModerationAction {
  constructor(data) {
    super(data);
    this.config = config.messages.commands.warn;
  }

  async exec(_document) {
    this.warn();
  }

  async warn() {
    const warningMessage = this.config.warning
      .replace('%u', this.data.user.username)
      .replace('%r', this.data.reason);
    this.data.member.send(warningMessage);

    // Envoyer les messages
    if (!this.data.moderator.user.bot || (this.data.sendSuccessIfBot && this.data.moderator.user.bot)) {
      const successMessage = this.config.successfullyWarned
        .replace('%d', this.data.id)
        .replace('%u', this.data.user.username)
        .replace('%r', this.data.reason);
      this.data.messageChannel.sendSuccess(successMessage, this.data.moderator);
    }
  }

  async after() {
    // Vérifier s'il a dépasser la limite d'avertissement avant le banissement
    const result = await db.sanctionsHistory.findOne({ memberId: this.data.user.id }).catch(console.error);

    let currentWarnCount = result.currentWarnCount + 1;
    if (currentWarnCount >= config.moderation.warnLimitBeforeBan) currentWarnCount = 0;
    await db.sanctionsHistory.update({ _id: result._id }, { $set: { currentWarnCount } }).catch(console.error);

    if (result.currentWarnCount + 1 === config.moderation.warnLimitBeforeBan) {
      await db.sanctions.remove({ member: this.data.user.id, type: ACTION_TYPE.WARN }, { multi: true }).catch(console.error);
      this.data.messageChannel.send(this.config.warnLimitReached);
      const data = new ModerationData()
        .setType(ACTION_TYPE.BAN)
        .setColor(config.colors.ban)
        .setReason(config.moderation.warnBanReason)
        .setDuration(config.moderation.warnBanTime * 1000)
        .setMember(this.data.member)
        .setModerator(this.data.guild.members.resolve(client.user.id))
        .setMessageChannel(this.data.messageChannel)
        .setFinishTimestamp();
      new BanAction(data).commit();
    }
  }
}

export default WarnAction;