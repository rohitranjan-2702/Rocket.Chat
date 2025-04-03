import { Agenda } from '@rocket.chat/agenda';
import type { AtLeast, IMessage, IUser } from '@rocket.chat/core-typings';

import { executeSendMessage } from '../../../lib/server/methods/sendMessage';
// import { MongoInternals } from 'meteor/mongo';

interface ISchedule {
	uid: IUser['_id'];
	message: AtLeast<IMessage, 'rid'>;
}

export class MessageScheduler {
	private isConnected: boolean;

	private scheduler: Agenda;

	constructor() {
		this.scheduler = new Agenda({
			// mongo: (MongoInternals.defaultRemoteCollectionDriver().mongo as any).client.db(),
			// TODO: remove after discussion
			db: { collection: 'rocketchat_msgs_scheduler', address: 'mongodb://localhost:27017/agenda' },
			// this ensures the same job doesn't get executed multiple times in a cluster
			defaultConcurrency: 1,
		});
		this.isConnected = false;
	}

	public async startScheduler(): Promise<void> {
		// defining the job
		this.scheduler.define('scheduleMessage', async (job) => {
			const { uid, message } = job.attrs.data as ISchedule;

			const sent = await executeSendMessage(uid, message);

			console.log(`scheduling msg ${sent}`);

			return sent;
		});

		if (!this.isConnected) {
			await this.scheduler.start();
			this.isConnected = true;
		}
	}

	public async scheduleOnce({ when, data }: { when: string | Date; data: ISchedule }): Promise<void | string> {
		try {
			await this.startScheduler();
			const job = await this.scheduler.schedule(when, 'scheduleMessage', data);

			console.log(job.attrs);

			return job.attrs._id.toString();
		} catch (e) {
			console.error(e);
		}
	}
}

const scheduler = new MessageScheduler();

await scheduler.startScheduler();

export default scheduler;
