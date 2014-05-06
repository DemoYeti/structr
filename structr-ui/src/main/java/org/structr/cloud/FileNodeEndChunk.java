/*
 *  Copyright (C) 2011 Axel Morgner, structr <structr@structr.org>
 *
 *  This file is part of structr <http://structr.org>.
 *
 *  structr is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  structr is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.cloud;

/**
 * Marks the end of a <code>FileNodeDataContainer</code>. This class does not contain binary content itself, its a marker only.
 *
 * @author Christian Morgner
 */
public class FileNodeEndChunk extends DataContainer {

	protected String containerId = null;
	protected long fileSize = 0;

	public FileNodeEndChunk() {}

	public FileNodeEndChunk(String containerId, long fileSize) {
		this.containerId = containerId;
		this.fileSize = fileSize;

		estimatedSize = 1024;
	}

	public long getFileSize() {
		return (fileSize);
	}

	public String getContainerId() {
		return (containerId);
	}

	@Override
	public Message process(final ServerContext context) {

		context.finishFile(this);

		return new AckPacket("FileEnd");
	}
}
