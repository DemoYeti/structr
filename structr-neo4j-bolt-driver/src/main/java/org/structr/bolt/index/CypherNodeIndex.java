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
package org.structr.bolt.index;

import java.util.Map;
import org.structr.api.NativeResult;
import org.structr.api.QueryResult;
import org.structr.api.graph.Node;
import org.structr.api.util.QueryUtils;
import org.structr.bolt.BoltDatabaseService;
import org.structr.bolt.SessionTransaction;
import org.structr.bolt.mapper.PathNodeMapper;

/**
 *
 */
public class CypherNodeIndex extends AbstractCypherIndex<Node> {

	private String tenantIdentifier = null;

	public CypherNodeIndex(final BoltDatabaseService db) {
		this(db, null);
	}

	public CypherNodeIndex(final BoltDatabaseService db, final String tenantIdentifier) {

		super(db);

		this.tenantIdentifier = tenantIdentifier;
	}

	@Override
	public String getQueryPrefix(final String typeLabel, final String sourceTypeLabel, final String targetTypeLabel) {

		final StringBuilder buf = new StringBuilder("MATCH (n:NodeInterface");

		if (tenantIdentifier != null) {

			buf.append(":");
			buf.append(tenantIdentifier);
		}

		if (typeLabel != null) {

			buf.append(":");
			buf.append(typeLabel);
		}

		buf.append(")");

		return buf.toString();
	}

	@Override
	public String getQuerySuffix(final boolean doPrefetching) {

		if (doPrefetching) {

			return " RETURN n, (n)-[]-() AS p";
		}

		return " RETURN DISTINCT n";
	}

	@Override
	public String getCountQuerySuffix() {
		return " WITH n RETURN { n: n.id, count: size((n)-[]-()) } AS count";
	}

	@Override
	public QueryResult<Node> getResult(final PageableQuery query) {

		final String countStatement = query.getCountStatement();
		final SessionTransaction tx = db.getCurrentTransaction();
		final NativeResult result   = tx.run(countStatement, query.getParameters());
		long maxDegree                    = 0;

		while (result.hasNext()) {

			final Map<String, Object> map   = result.next();
			final Map<String, Object> count = (Map<String, Object>)map.get("count");
			final String uuid               = (String)count.get("id");
			final Long num                  = (Long)count.get("count");

			if (num > maxDegree) {
				maxDegree = num;
			}
		}

		if (maxDegree > 10 && maxDegree < 200) {
			query.enablePrefetching();
		}

		return QueryUtils.map(new PathNodeMapper(db), new PrefetchNodeResultStream(db, query));
	}
}
