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

import org.structr.api.graph.Node;
import org.structr.api.util.QueryUtils;
import org.structr.bolt.BoltDatabaseService;
import org.structr.bolt.mapper.NodeNodeMapper;
import org.structr.bolt.mapper.NodeIdNodeMapper;

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
	public String getQuerySuffix(final PageableQuery query) {

		final StringBuilder buf = new StringBuilder();
		final String sortKey    = query.getSortKey();

		if (query.idsOnly()) {

			buf.append(" RETURN DISTINCT id(n)");

		} else {

			buf.append(" RETURN DISTINCT n");
		}

		if (sortKey != null) {

			buf.append(", n.`");
			buf.append(sortKey);
			buf.append("` AS sortKey");
		}

		return buf.toString();
	}

	@Override
	public Iterable<Node> getResult(final PageableQuery query) {

		if (query.idsOnly()) {

			return QueryUtils.map(new NodeIdNodeMapper(db), new NodeIdResultStream(db, query));

		} else {

			return QueryUtils.map(new NodeNodeMapper(db), new NodeResultStream(db, query));
		}
	}
}
