/**
 * Copyright (C) 2010-2014 Morgner UG (haftungsbeschränkt)
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.cloud;

import org.structr.cloud.message.Message;
import java.io.IOException;
import java.io.ObjectOutputStream;
import java.util.Queue;
import java.util.concurrent.ArrayBlockingQueue;

/**
 *
 * @author Christian Morgner
 */
public class Sender extends Thread {

	private final Queue<Message> outputQueue = new ArrayBlockingQueue<>(10000);
	private ObjectOutputStream outputStream  = null;
	private CloudConnection connection       = null;
	private int messagesInFlight             = 0;

	public Sender(final CloudConnection connection, final ObjectOutputStream outputStream) {

		super("Sender of " + connection.getName());
		this.setDaemon(true);

		this.outputStream = outputStream;
		this.connection   = connection;

		// flush stream to avoid ObjectInputStream to be waiting indefinitely
		try {

			outputStream.flush();

		} catch (IOException ioex) {
			ioex.printStackTrace();
		}
	}

	@Override
	public void run() {

		while (connection.isConnected()) {

			if (messagesInFlight < CloudService.LIVE_PACKET_COUNT) {

				try {

					final Message message = outputQueue.poll();
					if (message != null) {

						outputStream.writeObject(message);
						outputStream.flush();

						messagesInFlight++;

						message.afterSend(connection);
					}

				} catch (Throwable t) {

					connection.close();
				}

			} else {

				Thread.yield();
			}
		}
	}

	public void send(final Message message) {
		outputQueue.add(message);
	}

	public void messageReceived() {
		messagesInFlight--;
	}
}
