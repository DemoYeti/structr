/**
 * Copyright (C) 2010-2018 Structr GmbH
 *
 * This file is part of Structr <http://structr.org>.
 *
 * Structr is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Structr is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Structr.  If not, see <http://www.gnu.org/licenses/>.
 */
package org.structr.bolt.wrapper;

import java.util.Iterator;
import java.util.Map;
import org.neo4j.driver.v1.Records;
import org.neo4j.driver.v1.StatementResult;
import org.neo4j.driver.v1.Value;
import org.neo4j.driver.v1.exceptions.ClientException;
import org.neo4j.driver.v1.exceptions.DatabaseException;
import org.neo4j.driver.v1.exceptions.TransientException;
import org.structr.api.NativeResult;
import org.structr.api.RetryException;
import org.structr.api.util.Iterables;
import org.structr.bolt.BoltDatabaseService;
import org.structr.bolt.SessionTransaction;

/**
 *
 */
public class StatementResultWrapper<T> implements NativeResult<T> {

	private MixedResultWrapper wrapper = null;
	private StatementResult result     = null;
	private BoltDatabaseService db     = null;

	public StatementResultWrapper(final BoltDatabaseService db, final StatementResult result) {

		this.wrapper = new MixedResultWrapper<>(db);
		this.result  = result;
		this.db      = db;
	}

	@Override
	public Iterator columnAs(final String name) {

		final Iterable<Value> it = result.list(Records.column(name));

		return Iterables.map(t -> wrapper.apply(t.asObject()), it).iterator();
	}

	@Override
	public boolean hasNext() {

		try {
			return result.hasNext();

		} catch (TransientException tex) {
			db.getCurrentTransaction().setClosed(true);
			throw new RetryException(tex);
		} catch (DatabaseException dex) {
			throw SessionTransaction.translateDatabaseException(dex);
		} catch (ClientException cex) {
			throw SessionTransaction.translateClientException(cex);
		}
	}

	@Override
	public Map next() {
		return new MapResultWrapper(db, result.next().asMap());
	}

	@Override
	public void close() {
	}
}
