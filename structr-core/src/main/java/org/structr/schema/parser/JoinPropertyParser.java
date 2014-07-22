package org.structr.schema.parser;

import java.io.IOException;
import java.io.StreamTokenizer;
import java.io.StringReader;
import org.structr.common.error.ErrorBuffer;
import org.structr.common.error.FrameworkException;
import org.structr.core.property.JoinProperty;
import org.structr.schema.Schema;
import org.structr.schema.SchemaHelper;
import org.structr.schema.SchemaHelper.Type;

/**
 *
 * @author Christian Morgner
 */
public class JoinPropertyParser extends PropertyParser {

	private String parameters   = "";

	public JoinPropertyParser(final ErrorBuffer errorBuffer, final String className, final String propertyName, final String dbName, final String rawSource, final String defaultValue) {
		super(errorBuffer, className, propertyName, dbName, rawSource, defaultValue);
	}

	@Override
	public SchemaHelper.Type getKey() {
		return Type.Join;
	}

	@Override
	public String getPropertyType() {
		return JoinProperty.class.getSimpleName();
	}

	@Override
	public String getValueType() {
		return String.class.getSimpleName();
	}

	@Override
	public String getPropertyParameters() {
		return parameters;
	}

	@Override
	public void parseFormatString(Schema entity, String expression) throws FrameworkException {

		final StreamTokenizer tokenizer = new StreamTokenizer(new StringReader(expression));
		final StringBuilder buf         = new StringBuilder();

		tokenizer.wordChars('_', '_');

		String token = null;
		int type = 0;

		try {
			do {

				token = null;
				type = tokenizer.nextToken();

				switch (type) {

					case StreamTokenizer.TT_NUMBER:
						token = String.valueOf(tokenizer.nval);
						break;

					case StreamTokenizer.TT_WORD:
						token = tokenizer.sval;
						break;

					case StreamTokenizer.TT_EOF:
					case StreamTokenizer.TT_EOL:
						break;

					case '\'':
					case '\"':
						token = "\"" + tokenizer.sval + "\"";
						break;
				}

				if (token != null) {

					if (token.startsWith("_")) {

						token = token.substring(1) + "Property";
					}

					buf.append(", ");
					buf.append(token);
				}

			} while (type != StreamTokenizer.TT_EOF);

		} catch (IOException ex) {
			ex.printStackTrace();
		}

		parameters = buf.toString();
	}
}
