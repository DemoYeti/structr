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
package org.structr.cloud.message;

import java.io.IOException;
import javax.crypto.Cipher;
import org.structr.cloud.CloudConnection;
import org.structr.cloud.CloudService;
import org.structr.cloud.ExportContext;
import org.structr.common.error.FrameworkException;
import org.structr.core.entity.Principal;

/**
 *
 * @author Christian Morgner
 */


public class AuthenticationRequest extends Message {

	private String userName = null;
	private String salt     = null;
	private int keyLength   = 128;

	public AuthenticationRequest() {}

	public AuthenticationRequest(String userName, final int keyLength) {

		this.userName  = userName;
		this.keyLength = keyLength;
	}

	/**
	 * @return the userName
	 */
	public String getUserName() {
		return userName;
	}

	/**
	 * @param userName the userName to set
	 */
	public void setUserName(String userName) {
		this.userName = userName;
	}

	public String getSalt() {
		return salt;
	}

	public int getKeyLength() {
		return keyLength;
	}

	@Override
	public void onRequest(CloudConnection serverConnection, ExportContext context) throws IOException, FrameworkException {

		final Principal user = serverConnection.getUser(userName);
		if (user != null) {

			try {
				this.keyLength = Math.min(keyLength, Cipher.getMaxAllowedKeyLength(CloudService.STREAM_CIPHER));
				this.salt      = user.getProperty(Principal.salt);

				serverConnection.impersonateUser(user);
				serverConnection.send(new AuthenticationResponse(userName, user.getEncryptedPassword(), salt, keyLength));

			} catch (Throwable t) {
				t.printStackTrace();
			}

		} else {

			serverConnection.send(new Error(401, "Wrong username or password."));
		}
	}

	@Override
	public void onResponse(CloudConnection clientConnection, ExportContext context) throws IOException, FrameworkException {
	}

	@Override
	public void afterSend(CloudConnection conn) {
	}

	@Override
	public Object getPayload() {
		return null;
	}
}
