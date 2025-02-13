/*
 * Copyright (C) 2010-2024 Structr GmbH
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
package org.structr.bolt;

import org.apache.commons.lang.StringUtils;
import org.structr.api.graph.Direction;
import org.structr.api.graph.Node;
import org.structr.api.graph.Relationship;
import org.structr.api.graph.RelationshipType;
import org.structr.api.search.QueryContext;

import java.util.*;
import java.util.function.Supplier;
import java.util.LinkedList;
import org.structr.api.util.Iterables;

/**
 *
 */
class NodeWrapper extends EntityWrapper<org.neo4j.driver.types.Node> implements Node {

	private final TreeCache<Relationship> relationshipCache;
	private Set<String> prefetched = new LinkedHashSet<>();

	public NodeWrapper(final BoltDatabaseService db, final org.neo4j.driver.types.Node entity) {
		super(db, entity);

		this.relationshipCache = new TreeCache<>(entity.id(), "/");
	}

	@Override
	public String toString() {
		return "N" + getId();
	}

	@Override
	protected String getQueryPrefix() {
		return concat("MATCH (n", getTenantIdentifier(db), ")");
	}

	@Override
	public Relationship createRelationshipTo(final Node endNode, final RelationshipType relationshipType) {
		return createRelationshipTo(endNode, relationshipType, new LinkedHashMap<>());
	}

	@Override
	public Relationship createRelationshipTo(final Node endNode, final RelationshipType relationshipType, final Map<String, Object> properties) {

		final SessionTransaction tx   = db.getCurrentTransaction();
		final Map<String, Object> map = new HashMap<>();
		final String tenantIdentifier = getTenantIdentifier(db);
		final StringBuilder buf       = new StringBuilder();

		map.put("id1", id);
		map.put("id2", db.unwrap(endNode.getId()));
		map.put("relProperties", properties);

		buf.append("MATCH (n");
		buf.append(tenantIdentifier);
		buf.append("), (m");
		buf.append(tenantIdentifier);
		buf.append(") WHERE ID(n) = $id1 AND ID(m) = $id2 ");
		buf.append("MERGE (n)-[r:");
		buf.append(relationshipType.name());
		buf.append("]->(m)");
		buf.append(" SET r += $relProperties RETURN r");

		final RelationshipWrapper newRel = tx.getRelationshipWrapper(tx.getRelationship(buf.toString(), map));
		final NodeWrapper otherNode      = (NodeWrapper)endNode;
		final String relKey1             = createKey(newRel);
		final String relKey2             = otherNode.createKey(newRel);

		// we can't simply add the new relationship to the cache, because we don't know
		// if the cache was initialized before. If it was not initialized, adding the
		// relationship makes the system think there is only one relationship in the db.

		if (this.prefetched.contains(relKey1)) {

			this.storeRelationship(newRel, false);

		} else {

			this.invalidate();
		}
		if (((NodeWrapper) endNode).prefetched.contains(relKey2)) {

			((NodeWrapper)endNode).storeRelationship(newRel, false);

		} else {

			endNode.invalidate();
		}

		/*
		this.invalidate();
		endNode.invalidate();
		*/

		return newRel;
	}

	@Override
	public void addLabel(final String label) {

		final SessionTransaction tx   = db.getCurrentTransaction();
		final Map<String, Object> map = new HashMap<>();
		final String tenantIdentifier = getTenantIdentifier(db);

		map.put("id", id);

		tx.getNode(concat("MATCH (n", tenantIdentifier, ") WHERE ID(n) = $id SET n :", label, " RETURN n"), map);
	}

	@Override
	public void removeLabel(final String label) {

		final SessionTransaction tx   = db.getCurrentTransaction();
		final Map<String, Object> map = new HashMap<>();
		final String tenantIdentifier = getTenantIdentifier(db);

		map.put("id", id);

		tx.getNode(concat("MATCH (n", tenantIdentifier, ") WHERE ID(n) = $id REMOVE n:", label, " RETURN n"), map);
	}

	@Override
	public Iterable<String> getLabels() {

		final SessionTransaction tx   = db.getCurrentTransaction();
		final Map<String, Object> map = new HashMap<>();
		final String tenantIdentifier = getTenantIdentifier(db);

		map.put("id", id);

		// execute query
		return tx.getStrings(concat("MATCH (n", tenantIdentifier, ") WHERE ID(n) = $id RETURN LABELS(n)"), map);
	}

	@Override
	public boolean hasRelationshipTo(final RelationshipType type, final Node targetNode) {

		final SessionTransaction tx      = db.getCurrentTransaction();
		final Map<String, Object> params = new LinkedHashMap<>();
		final String tenantIdentifier    = getTenantIdentifier(db);

		params.put("id1", id);
		params.put("id2", db.unwrap(targetNode.getId()));

		try {

			// try to fetch existing relationship by node ID(s)
			return tx.getLong(concat("MATCH (n", tenantIdentifier, ")-[r:", type.name(), "]->(m", tenantIdentifier, ") WHERE id(n) = $id1 AND id(m) = $id2 RETURN id(r)"), params) != null;

		} catch (Throwable t) {

			t.printStackTrace();

			return false;
		}
	}

	@Override
	public Relationship getRelationshipTo(final RelationshipType type, final Node targetNode) {

		final SessionTransaction tx                 = db.getCurrentTransaction();
		final Map<String, Object> params            = new LinkedHashMap<>();
		final String tenantIdentifier               = getTenantIdentifier(db);

		params.put("id1", id);
		params.put("id2", db.unwrap(targetNode.getId()));

		try {

			return tx.getRelationshipWrapper(tx.getRelationship(concat("MATCH (n", tenantIdentifier, ")-[r:", type.name(), "]->(m", tenantIdentifier, ") WHERE id(n) = $id1 AND id(m) = $id2 RETURN r"), params));

		} catch (Throwable t) {
			t.printStackTrace();
		}

		return null;
	}

	@Override
	public Iterable<Relationship> getRelationships() {
		return fetchAndCacheRelationships(db, id, concat("(n", getTenantIdentifier(db), ")-[r]-(o)"), "RETURN r, o ORDER BY r.internalTimestamp", "all");
	}

	@Override
	public Iterable<Relationship> getRelationships(final Direction direction) {

		final String tenantIdentifier = getTenantIdentifier(db);
		final String key              = createKey(direction, null);

		switch (direction) {

			case BOTH:
				return getRelationships();

			case OUTGOING:
				return getRelationshipsFromCache(key, () -> fetchAndCacheRelationships(db, id, concat("(n", tenantIdentifier, ")-[r]->(t)"), "RETURN r, t ORDER BY r.internalTimestamp", key));

			case INCOMING:
				return getRelationshipsFromCache(key, () -> fetchAndCacheRelationships(db, id, concat("(n", tenantIdentifier , ")<-[r]-(s)"), "RETURN r, s ORDER BY r.internalTimestamp", key));
		}

		return null;
	}

	@Override
	public Iterable<Relationship> getRelationships(final Direction direction, final RelationshipType relationshipType) {

		final String tenantIdentifier = getTenantIdentifier(db);
		final String rel              = relationshipType.name();
		final String key              = createKey(direction, relationshipType);

		switch (direction) {

			case BOTH:
				final String key1 = createKey(Direction.OUTGOING, relationshipType);
				final String key2 = createKey(Direction.INCOMING, relationshipType);
				return Iterables.flatten(
					List.of(
						getRelationshipsFromCache(key1, () -> fetchAndCacheRelationships(db, id, concat("(n", tenantIdentifier, ")-[r:", rel, "]->(t", tenantIdentifier, ")"), "RETURN r, t ORDER BY r.internalTimestamp", key1)),
						getRelationshipsFromCache(key2, () -> fetchAndCacheRelationships(db, id, concat("(n", tenantIdentifier, ")<-[r:", rel, "]-(s", tenantIdentifier, ")"), "RETURN r, s ORDER BY r.internalTimestamp", key2))
					)
				);

			case OUTGOING:
				return getRelationshipsFromCache(key, () -> fetchAndCacheRelationships(db, id, concat("(n", tenantIdentifier, ")-[r:", rel, "]->(s", tenantIdentifier, ")"), "RETURN r, s ORDER BY r.internalTimestamp", key));

			case INCOMING:
				return getRelationshipsFromCache(key, () -> fetchAndCacheRelationships(db, id, concat("(n", tenantIdentifier, ")<-[r:", rel, "]-(s", tenantIdentifier, ")"), "RETURN r, s ORDER BY r.internalTimestamp", key));
		}

		return null;
	}

	@Override
	public void delete(final boolean deleteRelationships) {

		db.getCurrentTransaction().delete(this);

		super.delete(deleteRelationships);
	}

	/**
	 * Evaluate a custom query and return result as a boolean value
	 *
	 * @param customQuery
	 * @param parameters
	 * @return
	 */
	public boolean evaluateCustomQuery(final String customQuery, final Map<String, Object> parameters) {

		final SessionTransaction tx = db.getCurrentTransaction();
		boolean result              = false;

		try {
			result = tx.getBoolean(customQuery, parameters);

		} catch (Exception ignore) {}

		return result;
	}

	public void storeRelationship(final RelationshipWrapper rel, final boolean prefetched) {

		final String key = createKey(rel);

		relationshipCache.insert(key, rel);

		if (prefetched) {

			this.prefetched.add(key);
		}
	}

	/**
	 * Notifies this NodeWrapper that all keys contained in the keys parameter
	 * can be considered prefetched, so no additional database query needs to
	 * be made in the current transaction.
	 *
	 * @param keys
	 */
	public void storePrefetchInfo(final Set<String> keys) {
		this.prefetched.addAll(keys);
	}

	@Override
	public void invalidate() {

		relationshipCache.clear();
		prefetched.clear();
	}

	// ----- protected methods -----
	@Override
	protected boolean isNode() {
		return true;
	}

	// ----- private methods -----
	private Iterable<Relationship> fetchAndCacheRelationships(final BoltDatabaseService db, final long id, final String match, final String returnStatement, final String key) {

		final String whereStatement         = " WHERE ID(n) = $id ";
		final String statement              = concat("MATCH ", match, whereStatement, returnStatement);

		final CypherRelationshipIndex index = (CypherRelationshipIndex)db.relationshipIndex();
		final AdvancedCypherQuery query     = new RelationshipQuery(new QueryContext(), index, statement);

		query.getParameters().put("id", id);

		final Iterable<Relationship> rels = index.getResult(query);
		final List<Relationship> list     = new LinkedList<>();

		// store rels in cache
		for (final Relationship rel : rels) {

			final String relKey = createKey(rel);

			relationshipCache.insert(relKey, rel);
			list.add(rel);

			prefetched.add(relKey);
		}

		prefetched.add(key);

		return list;
	}

	private String createKey(final Relationship relationship) {
		return createKey(relationship.getDirectionForNode(this), relationship.getType());
	}

	private String createKey(final Direction direction, final RelationshipType type) {

		final StringBuilder buf = new StringBuilder("all");

		if (direction != null) {
			buf.append("/");
			buf.append(direction.name());
		}

		if (type != null) {
			buf.append("/");
			buf.append(type.name());
		}

		return buf.toString();
	}

	private Iterable<Relationship> getRelationshipsFromCache(final String key, final Supplier<Iterable<Relationship>> valueSupplier) {

		final Iterable<Relationship> relationships = relationshipCache.get(key);
		if (relationships == null) {

			if (prefetched.contains(key)) {

				return List.of();
			}

			return valueSupplier.get();
		}

		return relationships;
	}

	// ----- private static methods -----
	private static String concat(final String... parts) {

		final StringBuilder buf = new StringBuilder();

		for (final String part : parts) {

			// handle nulls gracefully (ignore)
			if (part != null) {

				buf.append(part);
			}
		}

		return buf.toString();
	}

	private static String getTenantIdentifier(final BoltDatabaseService db) {

		final String identifier = db.getTenantIdentifier();

		if (StringUtils.isNotBlank(identifier)) {

			return ":" + identifier;
		}

		return "";
	}

	private static class RelationshipQuery extends AdvancedCypherQuery {

		private String statement = null;

		public RelationshipQuery(QueryContext queryContext, AbstractCypherIndex<?> index, final String statement) {

			super(queryContext, index, Integer.MAX_VALUE, 1);

			this.statement = statement;
		}

		@Override
		public String getStatement(final boolean paged) {

			return statement;
		}

		@Override
		public int pageSize() {
			return Integer.MAX_VALUE;
		}
	}
}
